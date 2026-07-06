# Rabbit Alley POS — Receipt Printing Manual

This manual explains how to set up receipt printers for the Rabbit Alley Garden Bar & Bistro POS. The system supports **LAN (network) printers** (recommended) and **USB printers** as a fallback.

---

## Table of contents

1. [LAN (network) printers — recommended](#1-lan-network-printers--recommended)
2. [Three areas: Lounge, Club, LD](#2-three-areas-lounge-club-ld)
3. [USB printers (fallback)](#3-usb-printers-fallback)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. LAN (network) printers — recommended

Printers connected to your **LAN (Local Area Network)** via Ethernet or Wi‑Fi can receive receipts automatically after payment. No need to choose the printer each time.

### What you need

- One or more thermal receipt printers (e.g. XPrinter) on the same network as the POS computer.
- Each printer must support **ESC/POS** and **raw TCP port 9100** (most thermal LAN printers do).

### Step 1: Find each printer’s IP address

- **From the printer:** Use the printer’s menu or print a network configuration page (see printer manual).
- **From the router:** Log in to your router and check the list of connected devices (DHCP client list).
- **From the POS PC:** Run `arp -a` in Command Prompt, or check your router’s admin page.

Write down each IP, for example:

- Lounge receipt printer: `192.168.1.101`
- Club receipt printer: `192.168.1.102`
- LD receipt printer: `192.168.1.103`

### Step 2: Edit the server configuration

1. Open the **server** folder of the project.
2. Open the file **`.env`** (create it from **`.env.example`** if it doesn’t exist).
3. Find the line **`PRINTER_INTERFACE=`**.
4. Set it to **`tcp://IP:9100`** for each printer, separated by commas.

**One printer (all receipts go to the same printer):**

```env
PRINTER_INTERFACE=tcp://192.168.1.100:9100
```

**Three printers (one per area — Lounge, Club, LD):**

```env
PRINTER_INTERFACE=tcp://192.168.1.101:9100,tcp://192.168.1.102:9100,tcp://192.168.1.103:9100
```

Use your actual IPs. The port **9100** must stay as shown.

5. Save the file.

### Step 3: Restart the API server

- If you use **start.bat:** close the “API Server” window and run **start.bat** again.
- If you start the server manually: stop it (Ctrl+C) and run `node index.js` again from the **server** folder.

The server must be restarted after changing `.env` so it reads the new printer settings.

### Step 4: Assign printers to areas in the POS

1. Open the POS in the browser (e.g. `http://localhost:5173`).
2. Log in and go to **Settings**.
3. In **Receipt Settings**, find **“Receipt printers by area”**.
4. You will see one dropdown per area: **Lounge**, **Club**, **LD**.
5. For each area, select the matching **“Ethernet (IP:9100)”** printer (e.g. “Ethernet (192.168.1.101:9100)” for Lounge).
6. Save settings if there is a Save button.

After this, when a payment is completed at a table in Lounge, the receipt is sent to the Lounge printer; Club tables to the Club printer; LD to the LD printer.

---

## 2. Three areas: Lounge, Club, LD

The POS has three **areas**. Each can have its own receipt printer.

| Area   | Use case              | Printer in `.env` (example)        |
|--------|------------------------|------------------------------------|
| Lounge | Lounge tables          | First  `tcp://...:9100` in the list |
| Club   | Club tables            | Second                             |
| LD     | LD tables              | Third                              |

- In **`server/.env`** you list all LAN printers in one line, comma‑separated.
- In **Settings → Receipt printers by area** you assign which of those printers is used for Lounge, which for Club, and which for LD.

If you have only **one** LAN printer, put only one `tcp://IP:9100` in `.env`, then in Settings assign that same printer to Lounge, Club, and LD (or only to the areas you use).

---

## 3. USB printers (fallback)

If the receipt printer is connected by **USB** (and not over the LAN):

- Leave **`PRINTER_INTERFACE=`** empty in **`server/.env`** (or leave the line as in `.env.example`).
- After payment, when the screen says “Receipt was not sent to printer automatically,” click **“Print receipt”**.
- In the print dialog that opens, choose your USB printer (e.g. XPrinter) and click **Print**.

This is the same idea as choosing a printer in Loyverse or other POS apps when using USB.

---

## 4. Troubleshooting

### Receipt does not print (LAN)

- **Check the IP:** Ping the printer from the POS PC:  
  `ping 192.168.1.101`  
  (use your printer’s IP). If it doesn’t reply, fix the network or the IP.
- **Check `.env`:**  
  - No spaces around the `=` or between commas.  
  - Correct format: `tcp://192.168.1.101:9100`  
  - For three printers: `tcp://192.168.1.101:9100,tcp://192.168.1.102:9100,tcp://192.168.1.103:9100`
- **Restart the API server** after any change to `.env`.
- **Check Settings:** In POS Settings, make sure each area (Lounge, Club, LD) has the correct “Ethernet (IP:9100)” printer selected.

### Port 9100 blocked

Some networks or firewalls block port 9100. If the printer is reachable (ping works) but nothing prints:

- Temporarily disable the PC firewall or add an rule to allow outbound TCP to the printer’s IP, port 9100.
- Or ask your network admin to allow traffic to the printer on port 9100.

### “Port already in use” when starting the server

Another program (or an old copy of the server) is using the same port (e.g. 8000).

- Close any other terminal or window running the API server.
- Or in **`server/.env`** set a different port, e.g. `PORT=8001`, then restart the server and use the new port in the app URL if needed.

### USB: “Print receipt” does nothing or dialog doesn’t show

- Allow pop‑ups for the POS site in the browser.
- Try clicking **“Print receipt”** again, or use the browser’s own Print menu and select the USB printer.

---

## Quick reference

| Goal                         | Action |
|-----------------------------|--------|
| Use LAN printers            | Set `PRINTER_INTERFACE=tcp://IP:9100,...` in `server/.env`, restart server, assign in Settings. |
| One printer for all areas   | One `tcp://IP:9100` in `.env`; assign it to Lounge, Club, and LD in Settings. |
| Three printers (Lounge/Club/LD) | Three `tcp://IP1:9100,tcp://IP2:9100,tcp://IP3:9100` in `.env`; assign each in Settings. |
| Use USB only                | Leave `PRINTER_INTERFACE` empty; use “Print receipt” after payment and choose the printer. |

---

*Rabbit Alley Garden Bar & Bistro POS — Printing manual*
