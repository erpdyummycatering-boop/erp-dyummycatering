# Product Requirements Document (PRD)

**Project Name:** Catering Smart CRM & Master Data System
**Version:** 1.0
**Focus Areas:** CRM, Order Management, Master Data, Master Users

## 1. Executive Summary
The objective of this project is to build a modernized CRM and Master Data management system tailored for a catering business. The system tracks incoming leads, manages customer databases, processes orders, and maintains core master data (Products, Recipes, and Users). The application emphasizes a "zero-waste lead" philosophy, ensuring all inquiries are captured, and provides real-time monitoring of CS performance and order statuses.

## 2. Target Audience & User Roles
* **Super Admin / Owner:** Full access to all modules, including CRM dashboards, complete order tracking, master data management, and user administration.
* **Customer Service (CS) / Sales:** Access restricted to daily operational features: managing assigned leads, tracking customer interactions, creating orders, and viewing individual SLA performance.

## 3. Core Modules & Features

### 3.1. Smart CRM & Lead Management
* **Universal Logging:** All inquiries are recorded. Leads refusing to provide a name are saved with default identifiers (e.g., "Anonim_Date_Phone").
* **Lead Tracking:** Ability to track lead source (WhatsApp, Instagram, etc.), status (New Lead, Follow Up, Closed Won, Closed Lost), and the assigned CS (PIC).
* **Customer Database:** A centralized repository of customers containing contact information, order history count, and specific notes (e.g., dietary restrictions, preferred packages).

### 3.2. Order Management (CRM Focus)
* **Order Creation:** CS can generate orders linked to existing customers and leads. Requires inputs for delivery date, departure/arrival times, venue address, and special notes.
* **Package Details:** Dynamic entry for order items, allowing CS to select master products, specify custom menu requests, adjust quantities, and calculate subtotals and grand totals.
* **Confirmation Output:** Feature to trigger a PDF print simulation for order confirmation, formatted logically for A5 size (printed on A4).

### 3.3. Master Data Management
* **Products & Pricing:** Management of the catering package catalog, including name, category, description, selling price, and active status.
* **Recipes & Standard Cost (BOM):** Linking products to their raw material ingredients and defining the standard cost (HPP) to support future financial modules.
* **User Management (Internal):** Management of internal staff accounts, roles, access statuses, and individual KPI/SLA targets.