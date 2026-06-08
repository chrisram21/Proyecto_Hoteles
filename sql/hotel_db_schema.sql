--
-- PostgreSQL database dump
--

\restrict PWyyAp9lcJ8UiyghMajdUp2grfyhrijfVf7qdgDw2tQVVQR43rJt3NHF6OT7Ndm

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: fn_calcular_total(integer, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_calcular_total(p_id_habitacion integer, p_fecha_inicio date, p_fecha_fin date) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_precio NUMERIC;
    v_noches INT;
BEGIN
    SELECT t.precio_noche INTO v_precio
    FROM habitacion h
    JOIN tipo_habitacion t ON t.id_tipo = h.id_tipo
    WHERE h.id_habitacion = p_id_habitacion;

    v_noches := p_fecha_fin - p_fecha_inicio;   

    RETURN v_precio * v_noches;
END;
$$;


ALTER FUNCTION public.fn_calcular_total(p_id_habitacion integer, p_fecha_inicio date, p_fecha_fin date) OWNER TO postgres;

--
-- Name: fn_disponibilidad_rango(integer, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_disponibilidad_rango(p_id_tipo integer, p_fecha_inicio date, p_fecha_fin date) RETURNS TABLE(id_habitacion integer, numero character varying, piso integer, precio_noche numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT h.id_habitacion, h.numero, h.piso, t.precio_noche
    FROM habitacion h
    JOIN tipo_habitacion t ON t.id_tipo = h.id_tipo
    WHERE h.id_tipo = p_id_tipo                     
      AND h.estado <> 'mantenimiento'          
      AND NOT EXISTS (
          SELECT 1
          FROM reserva r
          WHERE r.id_habitacion = h.id_habitacion
            AND r.estado IN ('confirmada','en_curso','completada')
            AND r.fecha_inicio < p_fecha_fin             
            AND p_fecha_inicio < r.fecha_fin                
      );
END;
$$;


ALTER FUNCTION public.fn_disponibilidad_rango(p_id_tipo integer, p_fecha_inicio date, p_fecha_fin date) OWNER TO postgres;

--
-- Name: fn_saldo_reserva(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_saldo_reserva(p_id_reserva integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total  NUMERIC;
    v_pagado NUMERIC;
BEGIN
    -- 1) total de la factura de esta reserva
    SELECT total INTO v_total
    FROM factura
    WHERE id_reserva = p_id_reserva;

    -- 2) suma de pagos de esa factura (ojo con el NULL)
    SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM pago p
    JOIN factura f ON f.id_factura = p.id_factura
    WHERE f.id_reserva = p_id_reserva;

    -- 3) devolver el saldo
    RETURN v_total - v_pagado;
END;
$$;


ALTER FUNCTION public.fn_saldo_reserva(p_id_reserva integer) OWNER TO postgres;

--
-- Name: sp_checkout(integer, numeric, character varying); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.sp_checkout(IN p_id_reserva integer, IN p_monto_pago numeric, IN p_metodo character varying DEFAULT 'efectivo'::character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado        VARCHAR;
    v_id_habitacion INT;
    v_hospedaje     NUMERIC;
    v_consumos      NUMERIC;
    v_total_final   NUMERIC;
    v_id_factura    INT;
    v_pagado        NUMERIC;
BEGIN
    -- (a) la reserva debe estar 'en_curso'
    SELECT estado, id_habitacion, total_estimado
      INTO v_estado, v_id_habitacion, v_hospedaje
    FROM reserva
    WHERE id_reserva = p_id_reserva
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La reserva % no existe', p_id_reserva;
    END IF;
    IF v_estado <> 'en_curso' THEN
        RAISE EXCEPTION 'Solo se hace check-out de una reserva en curso (estado actual: %)', v_estado;
    END IF;

    -- (b) total final = hospedaje + consumos
    SELECT COALESCE(SUM(cantidad * precio_unitario), 0) INTO v_consumos
    FROM consumo WHERE id_reserva = p_id_reserva;
    v_total_final := v_hospedaje + v_consumos;

    -- (c) cerrar la factura con el total final
    UPDATE factura
       SET total = v_total_final, fecha_emision = CURRENT_TIMESTAMP
     WHERE id_reserva = p_id_reserva
     RETURNING id_factura INTO v_id_factura;

    -- (d) registrar el pago y actualizar estado de la factura
    SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM pago WHERE id_factura = v_id_factura;     

    IF v_pagado + p_monto_pago > v_total_final THEN
        RAISE EXCEPTION 'El pago excede el saldo: total %, ya pagado %, nuevo %',
            v_total_final, v_pagado, p_monto_pago;   -- RN-06
    END IF;

    IF p_monto_pago > 0 THEN
        INSERT INTO pago (id_factura, monto, metodo)
        VALUES (v_id_factura, p_monto_pago, p_metodo);
        v_pagado := v_pagado + p_monto_pago;
    END IF;

    UPDATE factura
       SET estado = CASE
                      WHEN v_pagado >= v_total_final THEN 'pagada'
                      WHEN v_pagado > 0              THEN 'pagada_parcial'
                      ELSE 'pendiente'
                    END
     WHERE id_factura = v_id_factura;               

    -- (e) reserva -> completada
    UPDATE reserva
       SET estado = 'completada', fecha_checkout_real = CURRENT_TIMESTAMP
     WHERE id_reserva = p_id_reserva;

    -- (f) habitación -> limpieza (RN-08)
    UPDATE habitacion SET estado = 'limpieza' WHERE id_habitacion = v_id_habitacion;

    -- (g) auditoría
    INSERT INTO log_auditoria (operacion, entidad, id_entidad, detalle)
    VALUES ('checkout', 'reserva', p_id_reserva,
            jsonb_build_object('total_final', v_total_final, 'pago', p_monto_pago, 'metodo', p_metodo));
EXCEPTION
    WHEN OTHERS THEN
        -- cualquier fallo revierte TODO el check-out y reporta con contexto
        RAISE EXCEPTION 'Error en el check-out de la reserva %: %', p_id_reserva, SQLERRM;
END;
$$;


ALTER PROCEDURE public.sp_checkout(IN p_id_reserva integer, IN p_monto_pago numeric, IN p_metodo character varying) OWNER TO postgres;

--
-- Name: sp_realizar_reserva(integer, integer, date, date, integer, integer); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.sp_realizar_reserva(IN p_id_huesped integer, IN p_id_habitacion integer, IN p_fecha_inicio date, IN p_fecha_fin date, IN p_num_huespedes integer, INOUT p_id_reserva integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estado_hab VARCHAR;
    v_capacidad  INT;
    v_total      NUMERIC;
BEGIN
    -- (a) la habitación existe y no está en mantenimiento
    SELECT h.estado, t.capacidad
      INTO v_estado_hab, v_capacidad
    FROM habitacion h
    JOIN tipo_habitacion t ON t.id_tipo = h.id_tipo
    WHERE h.id_habitacion = p_id_habitacion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La habitacion % no existe', p_id_habitacion;
    END IF;
    IF v_estado_hab = 'mantenimiento' THEN
        RAISE EXCEPTION 'La habitacion % esta en mantenimiento', p_id_habitacion;  -- RN-02
    END IF;

    -- (c) la cantidad de huéspedes no excede la capacidad 
    IF p_num_huespedes > v_capacidad THEN
        RAISE EXCEPTION 'La habitacion admite % huespedes y se solicitaron %',
            v_capacidad, p_num_huespedes;
    END IF;

    -- (b) validación previa de solape
    IF EXISTS (
        SELECT 1 FROM reserva r
        WHERE r.id_habitacion = p_id_habitacion
          AND r.estado IN ('confirmada','en_curso','completada')
          AND r.fecha_inicio < p_fecha_fin
          AND p_fecha_inicio < r.fecha_fin
    ) THEN
        RAISE EXCEPTION 'La habitacion % ya esta reservada en ese rango', p_id_habitacion;
    END IF;

    -- (d) calcular total (reutiliza la función)
    v_total := fn_calcular_total(p_id_habitacion, p_fecha_inicio, p_fecha_fin);

    -- (e) crear la reserva en estado confirmada
    INSERT INTO reserva (id_huesped, id_habitacion, fecha_inicio, fecha_fin,
                         num_huespedes, total_estimado, estado)
    VALUES (p_id_huesped, p_id_habitacion, p_fecha_inicio, p_fecha_fin,
            p_num_huespedes, v_total, 'confirmada')
    RETURNING id_reserva INTO p_id_reserva;

    -- (f) factura preliminar en estado pendiente
    INSERT INTO factura (id_reserva, total, estado)
    VALUES (p_id_reserva, v_total, 'pendiente');

    -- (g) auditoría
    INSERT INTO log_auditoria (operacion, entidad, id_entidad, detalle)
    VALUES ('crear_reserva', 'reserva', p_id_reserva,
            jsonb_build_object('id_huesped', p_id_huesped,
                               'id_habitacion', p_id_habitacion,
                               'fecha_inicio', p_fecha_inicio,
                               'fecha_fin', p_fecha_fin,
                               'total', v_total));
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Conflicto de concurrencia: la habitacion % fue reservada en ese rango por otra operacion',
            p_id_habitacion;
END;
$$;


ALTER PROCEDURE public.sp_realizar_reserva(IN p_id_huesped integer, IN p_id_habitacion integer, IN p_fecha_inicio date, IN p_fecha_fin date, IN p_num_huespedes integer, INOUT p_id_reserva integer) OWNER TO postgres;

--
-- Name: sp_registrar_pago(integer, numeric, character varying); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.sp_registrar_pago(IN p_id_factura integer, IN p_monto numeric, IN p_metodo character varying DEFAULT 'efectivo'::character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total  NUMERIC;
    v_pagado NUMERIC;
BEGIN
    -- bloquea la factura para evitar dos pagos simultáneos que se pasen del total
    SELECT total INTO v_total
    FROM factura WHERE id_factura = p_id_factura
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La factura % no existe', p_id_factura;
    END IF;

    SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM pago WHERE id_factura = p_id_factura;

    IF v_pagado + p_monto > v_total THEN
        RAISE EXCEPTION 'El pago excede el saldo (total %, pagado %, intento %)',
            v_total, v_pagado, p_monto;            -- RN-06
    END IF;

    INSERT INTO pago (id_factura, monto, metodo)
    VALUES (p_id_factura, p_monto, p_metodo);

    v_pagado := v_pagado + p_monto;

    UPDATE factura
       SET estado = CASE WHEN v_pagado >= v_total THEN 'pagada'
                         ELSE 'pagada_parcial' END
     WHERE id_factura = p_id_factura;              -- RN-07
END;
$$;


ALTER PROCEDURE public.sp_registrar_pago(IN p_id_factura integer, IN p_monto numeric, IN p_metodo character varying) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categoria_servicio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categoria_servicio (
    id_categoria integer NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE public.categoria_servicio OWNER TO postgres;

--
-- Name: categoria_servicio_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categoria_servicio_id_categoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categoria_servicio_id_categoria_seq OWNER TO postgres;

--
-- Name: categoria_servicio_id_categoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categoria_servicio_id_categoria_seq OWNED BY public.categoria_servicio.id_categoria;


--
-- Name: comodidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comodidad (
    id_comodidad integer NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE public.comodidad OWNER TO postgres;

--
-- Name: comodidad_id_comodidad_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comodidad_id_comodidad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comodidad_id_comodidad_seq OWNER TO postgres;

--
-- Name: comodidad_id_comodidad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comodidad_id_comodidad_seq OWNED BY public.comodidad.id_comodidad;


--
-- Name: consumo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consumo (
    id_consumo integer NOT NULL,
    id_reserva integer NOT NULL,
    id_servicio integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    fecha_consumo timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT consumo_cantidad_check CHECK ((cantidad > 0))
);


ALTER TABLE public.consumo OWNER TO postgres;

--
-- Name: consumo_id_consumo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.consumo_id_consumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consumo_id_consumo_seq OWNER TO postgres;

--
-- Name: consumo_id_consumo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.consumo_id_consumo_seq OWNED BY public.consumo.id_consumo;


--
-- Name: factura; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.factura (
    id_factura integer NOT NULL,
    id_reserva integer NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    estado character varying(15) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_emision timestamp without time zone,
    CONSTRAINT factura_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagada_parcial'::character varying, 'pagada'::character varying])::text[])))
);


ALTER TABLE public.factura OWNER TO postgres;

--
-- Name: factura_id_factura_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.factura_id_factura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.factura_id_factura_seq OWNER TO postgres;

--
-- Name: factura_id_factura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.factura_id_factura_seq OWNED BY public.factura.id_factura;


--
-- Name: habitacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.habitacion (
    id_habitacion integer NOT NULL,
    id_tipo integer NOT NULL,
    numero character varying(10) NOT NULL,
    piso integer NOT NULL,
    estado character varying(15) DEFAULT 'disponible'::character varying NOT NULL,
    CONSTRAINT habitacion_estado_check CHECK (((estado)::text = ANY ((ARRAY['disponible'::character varying, 'ocupada'::character varying, 'mantenimiento'::character varying, 'limpieza'::character varying])::text[])))
);


ALTER TABLE public.habitacion OWNER TO postgres;

--
-- Name: habitacion_id_habitacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.habitacion_id_habitacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.habitacion_id_habitacion_seq OWNER TO postgres;

--
-- Name: habitacion_id_habitacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.habitacion_id_habitacion_seq OWNED BY public.habitacion.id_habitacion;


--
-- Name: huesped; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.huesped (
    id_huesped integer NOT NULL,
    nombre character varying(50) NOT NULL,
    apellido character varying(50) NOT NULL,
    documento character varying(20) NOT NULL,
    email character varying(100),
    telefono character varying(20)
);


ALTER TABLE public.huesped OWNER TO postgres;

--
-- Name: huesped_id_huesped_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.huesped_id_huesped_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.huesped_id_huesped_seq OWNER TO postgres;

--
-- Name: huesped_id_huesped_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.huesped_id_huesped_seq OWNED BY public.huesped.id_huesped;


--
-- Name: log_auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.log_auditoria (
    id_log integer NOT NULL,
    operacion character varying(50) NOT NULL,
    entidad character varying(50) NOT NULL,
    id_entidad integer,
    detalle jsonb,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.log_auditoria OWNER TO postgres;

--
-- Name: log_auditoria_id_log_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.log_auditoria_id_log_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.log_auditoria_id_log_seq OWNER TO postgres;

--
-- Name: log_auditoria_id_log_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.log_auditoria_id_log_seq OWNED BY public.log_auditoria.id_log;


--
-- Name: reserva; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reserva (
    id_reserva integer NOT NULL,
    id_huesped integer NOT NULL,
    id_habitacion integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    fecha_checkin_real timestamp without time zone,
    fecha_checkout_real timestamp without time zone,
    num_huespedes integer NOT NULL,
    total_estimado numeric(10,2),
    estado character varying(15) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT reserva_check CHECK ((fecha_fin > fecha_inicio)),
    CONSTRAINT reserva_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'confirmada'::character varying, 'en_curso'::character varying, 'completada'::character varying, 'cancelada'::character varying, 'no_show'::character varying])::text[]))),
    CONSTRAINT reserva_num_huespedes_check CHECK ((num_huespedes > 0))
);


ALTER TABLE public.reserva OWNER TO postgres;

--
-- Name: tipo_habitacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_habitacion (
    id_tipo integer NOT NULL,
    nombre character varying(50) NOT NULL,
    capacidad integer NOT NULL,
    precio_noche numeric(10,2) NOT NULL,
    descripcion text,
    CONSTRAINT tipo_habitacion_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT tipo_habitacion_precio_noche_check CHECK ((precio_noche > (0)::numeric))
);


ALTER TABLE public.tipo_habitacion OWNER TO postgres;

--
-- Name: mv_ocupacion_mensual; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.mv_ocupacion_mensual AS
 SELECT (date_trunc('month'::text, (r.fecha_inicio)::timestamp with time zone))::date AS mes,
    t.nombre AS tipo,
    count(DISTINCT r.id_reserva) AS reservas,
    sum((r.fecha_fin - r.fecha_inicio)) AS noches_vendidas,
    sum(r.total_estimado) AS ingresos_hospedaje,
    COALESCE(sum(con.subtotal_consumos), (0)::numeric) AS ingresos_consumos
   FROM (((public.reserva r
     JOIN public.habitacion h ON ((h.id_habitacion = r.id_habitacion)))
     JOIN public.tipo_habitacion t ON ((t.id_tipo = h.id_tipo)))
     LEFT JOIN ( SELECT consumo.id_reserva,
            sum(((consumo.cantidad)::numeric * consumo.precio_unitario)) AS subtotal_consumos
           FROM public.consumo
          GROUP BY consumo.id_reserva) con ON ((con.id_reserva = r.id_reserva)))
  WHERE ((r.estado)::text = ANY ((ARRAY['completada'::character varying, 'en_curso'::character varying])::text[]))
  GROUP BY (date_trunc('month'::text, (r.fecha_inicio)::timestamp with time zone)), t.nombre
  ORDER BY ((date_trunc('month'::text, (r.fecha_inicio)::timestamp with time zone))::date), t.nombre
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.mv_ocupacion_mensual OWNER TO postgres;

--
-- Name: mv_top_huespedes; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.mv_top_huespedes AS
 SELECT hu.id_huesped,
    (((hu.nombre)::text || ' '::text) || (hu.apellido)::text) AS huesped,
    count(r.id_reserva) AS total_estadias,
    sum(f.total) AS gasto_total
   FROM ((public.huesped hu
     JOIN public.reserva r ON ((r.id_huesped = hu.id_huesped)))
     JOIN public.factura f ON ((f.id_reserva = r.id_reserva)))
  WHERE (((r.estado)::text = 'completada'::text) AND (r.fecha_inicio >= (CURRENT_DATE - '1 year'::interval)))
  GROUP BY hu.id_huesped, hu.nombre, hu.apellido
  ORDER BY (count(r.id_reserva)) DESC, (sum(f.total)) DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.mv_top_huespedes OWNER TO postgres;

--
-- Name: pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pago (
    id_pago integer NOT NULL,
    id_factura integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    metodo character varying(20) NOT NULL,
    fecha_pago timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pago_metodo_check CHECK (((metodo)::text = ANY ((ARRAY['efectivo'::character varying, 'tarjeta'::character varying, 'transferencia'::character varying])::text[]))),
    CONSTRAINT pago_monto_check CHECK ((monto > (0)::numeric))
);


ALTER TABLE public.pago OWNER TO postgres;

--
-- Name: pago_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pago_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pago_id_pago_seq OWNER TO postgres;

--
-- Name: pago_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pago_id_pago_seq OWNED BY public.pago.id_pago;


--
-- Name: reserva_id_reserva_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reserva_id_reserva_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reserva_id_reserva_seq OWNER TO postgres;

--
-- Name: reserva_id_reserva_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reserva_id_reserva_seq OWNED BY public.reserva.id_reserva;


--
-- Name: servicio_extra; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicio_extra (
    id_servicio integer NOT NULL,
    id_categoria integer NOT NULL,
    nombre character varying(50) NOT NULL,
    precio numeric(10,2) NOT NULL,
    CONSTRAINT servicio_extra_precio_check CHECK ((precio > (0)::numeric))
);


ALTER TABLE public.servicio_extra OWNER TO postgres;

--
-- Name: servicio_extra_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servicio_extra_id_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servicio_extra_id_servicio_seq OWNER TO postgres;

--
-- Name: servicio_extra_id_servicio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servicio_extra_id_servicio_seq OWNED BY public.servicio_extra.id_servicio;


--
-- Name: tipo_habitacion_comodidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipo_habitacion_comodidad (
    id_tipo integer NOT NULL,
    id_comodidad integer NOT NULL
);


ALTER TABLE public.tipo_habitacion_comodidad OWNER TO postgres;

--
-- Name: tipo_habitacion_id_tipo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tipo_habitacion_id_tipo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tipo_habitacion_id_tipo_seq OWNER TO postgres;

--
-- Name: tipo_habitacion_id_tipo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tipo_habitacion_id_tipo_seq OWNED BY public.tipo_habitacion.id_tipo;


--
-- Name: v_disponibilidad_inmediata; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_disponibilidad_inmediata AS
 SELECT h.id_habitacion,
    h.numero,
    h.piso,
    t.nombre AS tipo,
    t.capacidad,
    t.precio_noche
   FROM (public.habitacion h
     JOIN public.tipo_habitacion t ON ((t.id_tipo = h.id_tipo)))
  WHERE ((h.estado)::text = 'disponible'::text);


ALTER VIEW public.v_disponibilidad_inmediata OWNER TO postgres;

--
-- Name: v_huespedes_hospedados; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_huespedes_hospedados AS
 SELECT r.id_reserva,
    hu.id_huesped,
    (((hu.nombre)::text || ' '::text) || (hu.apellido)::text) AS huesped,
    h.numero AS habitacion,
    r.fecha_inicio AS check_in,
    r.fecha_fin AS check_out_estimado,
    (CURRENT_DATE - r.fecha_inicio) AS dias_transcurridos
   FROM ((public.reserva r
     JOIN public.huesped hu ON ((hu.id_huesped = r.id_huesped)))
     JOIN public.habitacion h ON ((h.id_habitacion = r.id_habitacion)))
  WHERE ((r.estado)::text = 'en_curso'::text);


ALTER VIEW public.v_huespedes_hospedados OWNER TO postgres;

--
-- Name: categoria_servicio id_categoria; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_servicio ALTER COLUMN id_categoria SET DEFAULT nextval('public.categoria_servicio_id_categoria_seq'::regclass);


--
-- Name: comodidad id_comodidad; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comodidad ALTER COLUMN id_comodidad SET DEFAULT nextval('public.comodidad_id_comodidad_seq'::regclass);


--
-- Name: consumo id_consumo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumo ALTER COLUMN id_consumo SET DEFAULT nextval('public.consumo_id_consumo_seq'::regclass);


--
-- Name: factura id_factura; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factura ALTER COLUMN id_factura SET DEFAULT nextval('public.factura_id_factura_seq'::regclass);


--
-- Name: habitacion id_habitacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habitacion ALTER COLUMN id_habitacion SET DEFAULT nextval('public.habitacion_id_habitacion_seq'::regclass);


--
-- Name: huesped id_huesped; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huesped ALTER COLUMN id_huesped SET DEFAULT nextval('public.huesped_id_huesped_seq'::regclass);


--
-- Name: log_auditoria id_log; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_auditoria ALTER COLUMN id_log SET DEFAULT nextval('public.log_auditoria_id_log_seq'::regclass);


--
-- Name: pago id_pago; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pago ALTER COLUMN id_pago SET DEFAULT nextval('public.pago_id_pago_seq'::regclass);


--
-- Name: reserva id_reserva; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserva ALTER COLUMN id_reserva SET DEFAULT nextval('public.reserva_id_reserva_seq'::regclass);


--
-- Name: servicio_extra id_servicio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicio_extra ALTER COLUMN id_servicio SET DEFAULT nextval('public.servicio_extra_id_servicio_seq'::regclass);


--
-- Name: tipo_habitacion id_tipo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_habitacion ALTER COLUMN id_tipo SET DEFAULT nextval('public.tipo_habitacion_id_tipo_seq'::regclass);


--
-- Name: categoria_servicio categoria_servicio_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_servicio
    ADD CONSTRAINT categoria_servicio_nombre_key UNIQUE (nombre);


--
-- Name: categoria_servicio categoria_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categoria_servicio
    ADD CONSTRAINT categoria_servicio_pkey PRIMARY KEY (id_categoria);


--
-- Name: comodidad comodidad_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comodidad
    ADD CONSTRAINT comodidad_nombre_key UNIQUE (nombre);


--
-- Name: comodidad comodidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comodidad
    ADD CONSTRAINT comodidad_pkey PRIMARY KEY (id_comodidad);


--
-- Name: consumo consumo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumo
    ADD CONSTRAINT consumo_pkey PRIMARY KEY (id_consumo);


--
-- Name: factura factura_id_reserva_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT factura_id_reserva_key UNIQUE (id_reserva);


--
-- Name: factura factura_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT factura_pkey PRIMARY KEY (id_factura);


--
-- Name: habitacion habitacion_numero_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habitacion
    ADD CONSTRAINT habitacion_numero_key UNIQUE (numero);


--
-- Name: habitacion habitacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habitacion
    ADD CONSTRAINT habitacion_pkey PRIMARY KEY (id_habitacion);


--
-- Name: huesped huesped_documento_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huesped
    ADD CONSTRAINT huesped_documento_key UNIQUE (documento);


--
-- Name: huesped huesped_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huesped
    ADD CONSTRAINT huesped_pkey PRIMARY KEY (id_huesped);


--
-- Name: log_auditoria log_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log_auditoria
    ADD CONSTRAINT log_auditoria_pkey PRIMARY KEY (id_log);


--
-- Name: reserva no_solape_reserva; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT no_solape_reserva EXCLUDE USING gist (id_habitacion WITH =, daterange(fecha_inicio, fecha_fin) WITH &&) WHERE (((estado)::text = ANY ((ARRAY['confirmada'::character varying, 'en_curso'::character varying, 'completada'::character varying])::text[])));


--
-- Name: pago pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_pkey PRIMARY KEY (id_pago);


--
-- Name: reserva reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_pkey PRIMARY KEY (id_reserva);


--
-- Name: servicio_extra servicio_extra_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicio_extra
    ADD CONSTRAINT servicio_extra_pkey PRIMARY KEY (id_servicio);


--
-- Name: tipo_habitacion_comodidad tipo_habitacion_comodidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_habitacion_comodidad
    ADD CONSTRAINT tipo_habitacion_comodidad_pkey PRIMARY KEY (id_tipo, id_comodidad);


--
-- Name: tipo_habitacion tipo_habitacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_habitacion
    ADD CONSTRAINT tipo_habitacion_pkey PRIMARY KEY (id_tipo);


--
-- Name: idx_consumo_reserva; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumo_reserva ON public.consumo USING btree (id_reserva);


--
-- Name: idx_pago_factura; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pago_factura ON public.pago USING btree (id_factura);


--
-- Name: idx_reserva_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reserva_estado ON public.reserva USING btree (estado);


--
-- Name: idx_reserva_huesped; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reserva_huesped ON public.reserva USING btree (id_huesped);


--
-- Name: consumo consumo_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumo
    ADD CONSTRAINT consumo_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: consumo consumo_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumo
    ADD CONSTRAINT consumo_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicio_extra(id_servicio);


--
-- Name: factura factura_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factura
    ADD CONSTRAINT factura_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: habitacion habitacion_id_tipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.habitacion
    ADD CONSTRAINT habitacion_id_tipo_fkey FOREIGN KEY (id_tipo) REFERENCES public.tipo_habitacion(id_tipo);


--
-- Name: pago pago_id_factura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_id_factura_fkey FOREIGN KEY (id_factura) REFERENCES public.factura(id_factura);


--
-- Name: reserva reserva_id_habitacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_id_habitacion_fkey FOREIGN KEY (id_habitacion) REFERENCES public.habitacion(id_habitacion);


--
-- Name: reserva reserva_id_huesped_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_id_huesped_fkey FOREIGN KEY (id_huesped) REFERENCES public.huesped(id_huesped);


--
-- Name: servicio_extra servicio_extra_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicio_extra
    ADD CONSTRAINT servicio_extra_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria_servicio(id_categoria);


--
-- Name: tipo_habitacion_comodidad tipo_habitacion_comodidad_id_comodidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_habitacion_comodidad
    ADD CONSTRAINT tipo_habitacion_comodidad_id_comodidad_fkey FOREIGN KEY (id_comodidad) REFERENCES public.comodidad(id_comodidad);


--
-- Name: tipo_habitacion_comodidad tipo_habitacion_comodidad_id_tipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipo_habitacion_comodidad
    ADD CONSTRAINT tipo_habitacion_comodidad_id_tipo_fkey FOREIGN KEY (id_tipo) REFERENCES public.tipo_habitacion(id_tipo);


--
-- PostgreSQL database dump complete
--

\unrestrict PWyyAp9lcJ8UiyghMajdUp2grfyhrijfVf7qdgDw2tQVVQR43rJt3NHF6OT7Ndm

