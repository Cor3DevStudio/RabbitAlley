# QZ Tray printing (Rabbit Alley POS)

## What it does

When **Use QZ Tray** is enabled in **Settings**, customer receipts, department chits (Bar / Kitchen / LD), and cashier order slips are printed **from the browser** through [QZ Tray](https://qz.io/) on that PC. The API only returns ESC/POS data (base64); the actual print goes to a local USB or Windows printer.

## Setup

1. Install **QZ Tray** on each POS/cashier PC: https://qz.io/download/
2. Start QZ Tray (system tray).
3. Open the POS in the browser. In QZ Tray → **Advanced** → **Site Manager**, **Allow** your site (e.g. `http://localhost:5173` or your LAN URL).
4. In POS **Settings**:
   - Turn **Use QZ Tray** **ON**
   - Click **Load printers from QZ Tray** — note the exact printer names
   - In **Receipt printers by area** and **Department chit printers**, pick the same names as shown by QZ (you can type them if they are not in the server list)

## Production signing

For HTTPS deployments, QZ expects a **signed certificate**. See: https://qz.io/docs/signing

## Toggle off

Turn **Use QZ Tray** **OFF** to use the previous flow (server → LAN `tcp://` or Windows printer from Node).
