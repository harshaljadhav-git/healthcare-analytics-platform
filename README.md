# PulseStream Healthcare Analytics Simulation Platform

Welcome to the **PulseStream Healthcare Analytics Simulation Platform**, a production-quality, high-throughput dataset synthesizer designed explicitly for data engineering pipelines, ETL benchmarks, Databricks experiments, and Medallion Lakehouse architectures.

This platform continuously generates realistic, synthetic, operational hospital network data (patients, doctors, clinical appointments, and financials) to demonstrate dynamic data ingestion and downstream aggregates.

---

## 🚀 Architectural Design & Ingestion Flow

```
                      [ PulseStream Generator Engine ]
               (Continuous Multi-Cadence Synthetic Operations)
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
 [ patients.csv ]            [ appointments.csv ]          [ transactions.csv ]
 (Raw Demographics)          (Roster & Durations)          (Insured Billing Ledger)
      │                              │                              │
      └──────────────────────────────┼──────────────────────────────┘
                                     ▼
                      [ Databricks Bronze Layer ]
                  (Append-Only Raw Parquet Delta Tables)
                                     │
                                     ▼
                      [ Databricks Silver Layer ]
                (Cleaned, Deduplicated, Validated Dimension)
                                     │
                                     ▼
                       [ Databricks Gold Layer ]
                  (Semantic Materialized Business Views)
```

---

## 🔑 Pre-Configured Console Access Credentials

PulseStream features full **Role-Based Access Control (RBAC)**. Log in as any of the following users to explore custom dashboards and data pools tailored to their corporate mandates:

| Username | Password | Role / Access Levels | Use Cases Covered |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **Admin** / Full Control | Configuration of simulator speed (Pause, Live, 10x, 50x), manual burst generation, database wipes and seed resets. |
| **`doctor`** | `doctor123` | **Doctor** / Clinician Board | Roster logs, doctor patient counts, card files, and ward booking utilisation charts. |
| **`analyst`** | `analyst123` | **Analyst** / Data Platform | Bronze/Silver/Gold analytics, ready-to-run PySpark templates, and interactive SQL testing sandbox. |
| **`finance`** | `finance123` | **Finance** / Chief Auditor | Insurer claim payouts charts, CFO transactional registers, and billing segment summaries.|

---

## 🐳 Running Under Docker & Local Setup

### Prerequisite Environment
- Docker and Docker Compose installed.

### Quick Start Inbound Commands:
To build and run the entire suite in a micro-container, execute:

```bash
# 1. Boot up the PulseStream container group
docker compose up --build -d

# 2. Verify container logs are active
docker compose logs -f

# 3. Check application wellness probe
curl http://localhost:3000/health
```

Now, navigate to **`http://localhost:3000`** in any web browser to access the active management console.

---

## 📊 Medallion Table Schemas & Lake Exporters

PulseStream exposes direct, high-performance CSV and JSON endpoints suitable for `spark.read` imports or cron ingestion workers:

| Inbound Stream | Target Schema Fields | Excel/CSV Ingress URL | JSON Raw Stream URL |
| :--- | :--- | :--- | :--- |
| **Patients** | `id`, `name`, `age`, `gender`, `bloodGroup`, `city`, `state`, `registrationDate`, `insuranceProvider`, `category` | `/api/export/csv/patients` | `/api/export/json/patients` |
| **Appointments** | `id`, `patientId`, `doctorId`, `department`, `appointmentDate`, `duration`, `status`, `revenueGenerated` | `/api/export/csv/appointments` | `/api/export/json/appointments` |
| **Doctors** | `id`, `name`, `department`, `experience`, `consultationFee`, `utilization` | `/api/export/csv/doctors` | `/api/export/json/doctors` |
| **Transactions** | `id`, `patientId`, `appointmentId`, `date`, `amount`, `type`, `insuranceCoverage`, `paymentType`, `department` | `/api/export/csv/transactions` | `/api/export/json/transactions` |

---

## 🧱 Real Databricks PySpark Loaders

Copy and paste this production-ready PySpark script into a Databricks Notebook to stream and backfill raw CSV tuples directly into your **Delta Lake Bronze Layer**:

```python
# Create automated ingestion wrapper for PulseStream lakes
ingress_base_url = "http://YOUR_DEPLOYED_CONTAINER_IP:3000/api/export/csv/"
tables = ["patients", "appointments", "doctors", "transactions"]

for table in tables:
    # Read live csv stream
    raw_df = spark.read \
        .format("csv") \
        .option("header", "true") \
        .option("inferSchema", "true") \
        .load(f"{ingress_base_url}{table}")
        
    # Append load into Databricks Delta Lakehouses (Bronze Stage)
    raw_df.write \
        .format("delta") \
        .mode("append") \
        .save(f"/mnt/pulse_healthcare/bronze/{table}")

print("✅ Inbound Delta Append-Batch Execution Complete.")
```

---

## 🛡️ Observability and Prometheus Integration

The platform includes active standard metrics exporting endpoint at **`/metrics`** to integrate with downstream Prometheus scrapers and Grafana.

Try loading the raw telemetry data:
```bash
curl http://localhost:3000/metrics
```
