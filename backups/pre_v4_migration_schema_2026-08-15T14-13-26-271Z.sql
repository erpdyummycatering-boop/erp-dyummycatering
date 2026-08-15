--
-- PostgreSQL database dump
--

\restrict rAGYtJMmPenP7V0ZAND5HVgIRNjH8JeM2rCdGivfDbVYa0fXqTlJQTMt1dLuXZQ

-- Dumped from database version 17.10 (29ad1b7)
-- Dumped by pg_dump version 18.4

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customers (
    id bigint DEFAULT nextval('public.customers_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    email character varying(255),
    type character varying(100),
    address text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    status character varying(50) DEFAULT 'Prospek'::character varying
);


ALTER TABLE public.customers OWNER TO neondb_owner;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.order_items (
    id bigint DEFAULT nextval('public.order_items_id_seq'::regclass) NOT NULL,
    order_id bigint,
    product_id bigint,
    custom_menu text,
    price numeric(15,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    discount numeric(15,2) DEFAULT 0,
    subtotal numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.order_items OWNER TO neondb_owner;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id bigint DEFAULT nextval('public.orders_id_seq'::regclass) NOT NULL,
    customer_id bigint,
    lead_id bigint,
    pic_id bigint,
    order_date date NOT NULL,
    delivery_date date NOT NULL,
    departure_time time without time zone,
    arrival_time time without time zone,
    venue text,
    order_notes text,
    status_order character varying(50) DEFAULT 'Baru'::character varying,
    status_payment character varying(50) DEFAULT 'Belum Lunas'::character varying,
    grand_total numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    jenis_order character varying(50),
    closing_date date,
    shipping_fee numeric(15,2) DEFAULT 0,
    additional_menu_price numeric(15,2) DEFAULT 0,
    recipient_name character varying(255),
    recipient_phone character varying(50)
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- Name: overheads; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.overheads (
    id bigint DEFAULT nextval('public.overheads_id_seq'::regclass) NOT NULL,
    finance_id bigint,
    expense_date date NOT NULL,
    category character varying(100) NOT NULL,
    amount numeric(15,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.overheads OWNER TO neondb_owner;

--
-- Name: products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.products (
    id bigint DEFAULT nextval('public.products_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    category_id bigint,
    description text,
    price numeric(15,2) NOT NULL,
    status character varying(50) DEFAULT 'Aktif'::character varying,
    image_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.products OWNER TO neondb_owner;

--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: overheads overheads_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.overheads
    ADD CONSTRAINT overheads_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: customers_phone_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX customers_phone_key ON public.customers USING btree (phone);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: orders orders_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: orders orders_pic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pic_id_fkey FOREIGN KEY (pic_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overheads overheads_finance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.overheads
    ADD CONSTRAINT overheads_finance_id_fkey FOREIGN KEY (finance_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict rAGYtJMmPenP7V0ZAND5HVgIRNjH8JeM2rCdGivfDbVYa0fXqTlJQTMt1dLuXZQ

