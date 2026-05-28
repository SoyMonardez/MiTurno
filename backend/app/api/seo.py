from datetime import datetime
from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.models.negocio import Negocio

router = APIRouter(tags=["SEO"])


@router.get("/robots.txt", response_class=Response)
def get_robots_txt() -> Response:
    sitemap_url = f"{settings.frontend_url}/sitemap.xml"
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin/\n"
        "Disallow: /admin\n\n"
        f"Sitemap: {sitemap_url}\n"
    )
    return Response(content=content, media_type="text/plain")


@router.get("/sitemap.xml", response_class=Response)
def get_sitemap_xml(db: Session = Depends(get_db)) -> Response:
    negocios = db.scalars(select(Negocio).where(Negocio.activo == True)).all()

    # Generar XML de Sitemap estándar
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    # URL principal del portal / landing page
    xml_lines.append("  <url>")
    xml_lines.append(f"    <loc>{settings.frontend_url}/</loc>")
    xml_lines.append("    <changefreq>daily</changefreq>")
    xml_lines.append("    <priority>1.0</priority>")
    xml_lines.append("  </url>")

    # URLs de negocios activos
    for negocio in negocios:
        base_url = settings.frontend_url.rstrip("/")
        loc = f"{base_url}/{negocio.slug}"
        
        lastmod = (
            negocio.creado_en.strftime("%Y-%m-%d")
            if negocio.creado_en
            else datetime.utcnow().strftime("%Y-%m-%d")
        )
        
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{loc}</loc>")
        xml_lines.append(f"    <lastmod>{lastmod}</lastmod>")
        xml_lines.append("    <changefreq>weekly</changefreq>")
        xml_lines.append("    <priority>0.8</priority>")
        xml_lines.append("  </url>")

    xml_lines.append("</urlset>")
    xml_content = "\n".join(xml_lines)
    return Response(content=xml_content, media_type="application/xml")
