"""Generate a compact two-column, one-page resume PDF."""
from fpdf import FPDF
from fpdf.enums import XPos, YPos


class TwoColumnResume(FPDF):
    LEFT_W = 58
    GAP = 5

    def __init__(self):
        super().__init__(format="Letter")
        self.set_auto_page_break(auto=False)
        self.set_margins(12, 10, 12)
        self._col = "left"
        self._col_start_y = 0.0

    @property
    def left_x(self) -> float:
        return self.l_margin

    @property
    def right_x(self) -> float:
        return self.l_margin + self.LEFT_W + self.GAP

    @property
    def right_w(self) -> float:
        return self.w - self.r_margin - self.right_x

    @property
    def col_w(self) -> float:
        return self.LEFT_W if self._col == "left" else self.right_w

    @property
    def col_x(self) -> float:
        return self.left_x if self._col == "left" else self.right_x

    def use_column(self, side: str):
        self._col = side
        self.set_x(self.col_x)

    def begin_columns(self, y: float):
        self._col_start_y = y
        self.use_column("left")
        self.set_y(y)

    def end_columns(self):
        pass

    def section(self, title: str, size: int = 8):
        self.ln(2)
        self.set_font("Helvetica", "B", size)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3.5, title.upper())
        self.set_draw_color(180, 180, 180)
        self.line(self.col_x, self.get_y(), self.col_x + self.col_w, self.get_y())
        self.ln(1.5)

    def text_block(self, text: str, size: int = 7.5, style: str = ""):
        self.set_font("Helvetica", style, size)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3.2, text)
        self.ln(0.5)

    def bullet(self, text: str, size: int = 7.5):
        self.set_font("Helvetica", "", size)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3.2, f"- {text}")
        self.ln(0.3)

    def job(self, title: str, meta: str):
        self.set_font("Helvetica", "B", 8)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3.5, title)
        self.set_font("Helvetica", "", 7)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3, meta)
        self.ln(0.5)

    def project(self, name: str, desc: str, stack: str, link: str):
        self.set_font("Helvetica", "B", 7.5)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3.2, name)
        self.set_font("Helvetica", "", 7)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3, desc)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3, stack)
        self.set_font("Helvetica", "I", 6.5)
        self.set_x(self.col_x)
        self.multi_cell(self.col_w, 3, link)
        self.ln(1)


def build_pdf(output_path: str):
    pdf = TwoColumnResume()
    pdf.add_page()

    # Full-width header
    pdf.set_font("Helvetica", "B", 15)
    pdf.cell(0, 6, "KARL DARNAYLA", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(
        0,
        3.5,
        "Software Engineer  |  Full-Stack  |  TypeScript  |  React  |  Node.js  |  Python",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
        align="C",
    )
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(
        0,
        3.5,
        "Quezon City, PH  |  darnaylakarl@gmail.com  |  linkedin.com/in/karl-darnayla-113826257  |  github.com/Keeydi  |  karldarn.click",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
        align="C",
    )
    pdf.ln(2)

    col_top = pdf.get_y()
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(pdf.left_x, col_top, pdf.LEFT_W, pdf.h - col_top - 10, style="F")
    pdf.set_draw_color(210, 210, 210)
    pdf.line(pdf.right_x - 2, col_top, pdf.right_x - 2, pdf.h - 10)

    # --- LEFT COLUMN ---
    pdf.begin_columns(col_top)

    pdf.section("Contact", 7)
    pdf.text_block("Quezon City, Philippines")
    pdf.text_block("darnaylakarl@gmail.com")
    pdf.text_block("karldarn.click")

    pdf.section("Education", 7)
    pdf.text_block("BS Information Technology", style="B")
    pdf.text_block("Our Lady of Fatima University")
    pdf.text_block("Coursework completed; awaiting graduation (2026)")

    pdf.section("Skills", 7)
    for line in [
        "TypeScript, JavaScript, Python, PHP",
        "React, React Native",
        "Node.js, Express, FastAPI, Laravel",
        "RESTful APIs, JWT, Supabase",
        "MySQL, SQLite",
        "Vercel, Ubuntu",
    ]:
        pdf.bullet(line, 7)

    pdf.section("Certifications", 7)
    for cert in [
        "CCNA: Switching, Routing & Wireless",
        "CCNA: Introduction to Networks",
        "Cyber Threat Management (DICT-ITU)",
        "Ethical Hacker (Cisco Academy)",
        "Network Defense (Cisco Academy)",
    ]:
        pdf.bullet(cert, 6.5)

    left_end = pdf.get_y()

    # --- RIGHT COLUMN ---
    pdf.use_column("right")
    pdf.set_y(col_top)

    pdf.section("Summary", 8)
    pdf.text_block(
        "Full-stack developer shipping production apps with TypeScript, React, and Node.js. "
        "Focus on auth systems, RESTful APIs, and live deployments."
    )

    pdf.section("Experience", 8)

    pdf.job("Freelance Contract Developer", "Remote  |  Jan 2026 - Present")
    pdf.bullet("Auth, dashboards, and API integrations for remote clients (React/Node.js).")
    pdf.bullet("Maintain 3 live apps: Christmas Decors PH, SecureAuth, Allowance Ally.")

    pdf.job("Full-Stack Developer, Beam PH", "Philippines  |  2025")
    pdf.bullet("Shipped production features across React frontends and Node.js APIs.")
    pdf.bullet("Improved API performance via query optimization and tighter contracts.")

    pdf.job("Full-Stack Developer, Independent", "Philippines  |  2024")
    pdf.bullet("Built client features end-to-end with React and Node.js.")
    pdf.bullet("Delivered LedgerMonitor and KamustaJuan (TypeScript + Python backends).")

    pdf.section("Projects", 8)

    projects = [
        (
            "Christmas Decors PH",
            "Seasonal e-commerce storefront with product catalog and checkout flow.",
            "React, TypeScript, Node.js",
            "karldarn.click",
        ),
        (
            "SecureAuth",
            "MFA platform with TOTP, RBAC, JWT sessions, and audit logs.",
            "React, TypeScript, Supabase, Vercel",
            "secure-access-hub.vercel.app",
        ),
        (
            "Allowance Ally",
            "Student budget tracker with categories, savings goals, and alerts.",
            "React, TypeScript, Supabase",
            "allowance-ally.vercel.app",
        ),
        (
            "LedgerMonitor",
            "Parking monitor with camera capture and ML plate detection.",
            "React, Node.js, Python, SQLite",
            "github.com/Keeydi/LedgerMonitor",
        ),
        (
            "KamustaJuan",
            "Travel translator with AI chat, payments, and admin dashboard.",
            "React Native, Flask, MySQL",
            "github.com/Keeydi/KamustaJuan",
        ),
    ]
    for name, desc, stack, link in projects:
        pdf.project(name, desc, stack, link)

    right_end = pdf.get_y()
    pdf.end_columns()

    if max(left_end, right_end) > pdf.h - 12:
        raise RuntimeError("Content exceeds one page; trim further.")

    pdf.output(output_path)


if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).resolve().parent.parent / "Karl-Darnayla-Resume-ATS.pdf"
    build_pdf(str(out))
    print(f"Wrote {out}")
