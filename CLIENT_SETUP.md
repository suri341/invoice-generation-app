# Jagannath Enterprises Invoice System – Running Locally with Docker

## Prerequisites
- **Docker Desktop** installed and running (wait until it shows "running").
- Free ports on the machine: **80** (website), **8000** (API). The database uses **5433**.

## 1. First-time setup
Open a terminal in the project folder:
```bash
cd invoice-generation-app-main
chmod +x docker-invoice.sh        # one time only
```

## 2. Start the application
```bash
./docker-invoice.sh apply
```
- Website: http://localhost
- API health check: http://localhost:8000/health

## 3. Everyday commands
| Task | Command |
|---|---|
| Check if the app is running | `./docker-invoice.sh status` |
| Stop the app (**data is kept**) | `./docker-invoice.sh destroy` |
| Start again / apply code updates | `./docker-invoice.sh apply` |
| Back up the database | `./docker-invoice.sh backup` |
| Restore a backup | `./docker-invoice.sh restore backups/<file>.sql.gz` |
| **Delete everything including all data** | `./docker-invoice.sh destroy --purge-data` |

## Important notes
- Data is stored in a Docker volume and survives `destroy` / `apply` and computer restarts. It is removed **only** by `--purge-data`, which asks you to type `DELETE-DATABASE` to confirm.
- `backup` saves a compressed file in the `backups/` folder. If `rclone` is configured with a Google Drive remote named `gdrive`, the backup is also uploaded there automatically.
- `restore` replaces all current data and asks you to type `RESTORE` to confirm.
- Take a backup regularly, and always before `--purge-data`.
- If port 80 or 8000 is already in use, pick other ports:
  ```bash
  FRONTEND_PORT=8080 BACKEND_PORT=8001 ./docker-invoice.sh apply
  ```
  then open http://localhost:8080.

## Using the application
1. **Customers** – add customers (including Customer Type, Missionary Type, TPH). Use **Download Excel** to export all customers.
2. **Parts** – add parts with unit, price and HSN code. Use **Download Excel** to export all parts.
3. **Parts Stock** – enter the quantity available for each part and click **Save**.
4. **New Quotation** (top-right button) – create a quotation. Stock is not affected.
5. **Invoices** page – click the **→ (Convert to invoice)** button on a quotation.
   - Conversion is blocked with a message if stock is not enough.
   - On success, the stock is reduced automatically. Deleting an invoice returns its stock.
6. **Dashboard** – revenue (invoices only), recent documents, and the monthly report (CSV) download.
