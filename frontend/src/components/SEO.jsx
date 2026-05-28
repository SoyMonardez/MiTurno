import { useEffect } from "react";

export default function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  imageUrl,
  type = "website",
  noIndex = false,
  schema,
}) {
  useEffect(() => {
    // 1. Title
    if (title) {
      document.title = title;
    }

    // Helper to get or create meta tag
    const getOrCreateMeta = (attr, attrValue) => {
      let element = document.querySelector(`meta[${attr}="${attrValue}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, attrValue);
        document.head.appendChild(element);
      }
      return element;
    };

    // 2. Robots / Directiva de rastreo
    const robotsMeta = getOrCreateMeta("name", "robots");
    robotsMeta.content = noIndex ? "noindex, nofollow" : "index, follow";

    if (!noIndex) {
      // 3. Description
      if (description) {
        const descMeta = getOrCreateMeta("name", "description");
        descMeta.content = description;
      }

      // 4. Keywords
      if (keywords) {
        const keyMeta = getOrCreateMeta("name", "keywords");
        keyMeta.content = Array.isArray(keywords) ? keywords.join(", ") : keywords;
      }

      // 5. Open Graph
      if (title) {
        const ogTitle = getOrCreateMeta("property", "og:title");
        ogTitle.content = title;
      }
      if (description) {
        const ogDesc = getOrCreateMeta("property", "og:description");
        ogDesc.content = description;
      }
      if (imageUrl) {
        const ogImg = getOrCreateMeta("property", "og:image");
        ogImg.content = imageUrl;
      }
      const ogUrl = getOrCreateMeta("property", "og:url");
      ogUrl.content = canonicalUrl || window.location.href;

      const ogType = getOrCreateMeta("property", "og:type");
      ogType.content = type;

      // 6. Twitter Cards
      const twCard = getOrCreateMeta("name", "twitter:card");
      twCard.content = "summary_large_image";
      
      if (title) {
        const twTitle = getOrCreateMeta("name", "twitter:title");
        twTitle.content = title;
      }
      if (description) {
        const twDesc = getOrCreateMeta("name", "twitter:description");
        twDesc.content = twDesc.content = description;
      }
      if (imageUrl) {
        const twImg = getOrCreateMeta("name", "twitter:image");
        twImg.content = imageUrl;
      }
    }

    // 7. Canonical URL link tag
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    }

    // 8. JSON-LD Schema (Marcado Estructurado)
    const schemaId = "seo-schema-jsonld";
    let schemaScript = document.getElementById(schemaId);
    if (schema) {
      if (!schemaScript) {
        schemaScript = document.createElement("script");
        schemaScript.id = schemaId;
        schemaScript.type = "application/ld+json";
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schema, null, 2);
    } else {
      if (schemaScript) {
        schemaScript.remove();
      }
    }

    // Limpieza al desmontar
    return () => {
      const scriptToClean = document.getElementById(schemaId);
      if (scriptToClean) {
        scriptToClean.remove();
      }
    };
  }, [title, description, keywords, canonicalUrl, imageUrl, type, noIndex, schema]);

  return null;
}
