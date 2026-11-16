# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Confirmed by Daniel (2026-11-16), in this order of reach, all of them first-class:

1. **The public, anyone.** People who want to know the next shows, promotions and events; follow their favourite wrestlers; and see photos of the shows they went to (or missed).
2. **The wrestling industry abroad.** International promotions and bookers who should notice the roster: the site works as a professional showcase of the wrestlers.

## Product Purpose

triplew.es is the home of Triple W / WhiteWolf Wrestling, an independent pro wrestling promotion in Madrid (founded 2009) whose roster trains at its own school, Lucharama (separate site, not in scope here). The site announces shows, keeps the roster, championships and results, and archives the photography of every show. Success: it becomes the reference wrestling website, the one people point to, rather than one more promotion page.

## Positioning

The big references (WWE, UFC) are important but their sites are gridded and conventional. Triple W must break that mould: "algo loco". What a neighbour cannot copy: entrada inversa (pay what you want on the way out), a home-grown roster from its own school, a distinct graphic identity per show, and a deep archive of ringside photography by @wrestlingphotoshow (Daniel).

## Operating Context

- Shows roughly every two weeks at Gimnasio Lucharama (Carabanchel, Madrid) with entrada inversa; special events (e.g. Top 1 at Sala Revi) sell tickets through Entradium.
- Instagram (@latriplew) publishes three recurring formats: ¡ANUNCIO!, ¡RECORDATORIO!, RESULTADOS RÁPIDOS. The site mirrors them as card, event page and results archive.
- Championships: Absoluto, Level One, Parejas, Extremo; Hall of Fame.
- The association must run the site by itself. An admin panel (Sveltia CMS, built in another thread) edits the data files; every piece of editable content (shows, roster, titles, galleries, entrance videos, stats, copy) must live in `shared/data/*.json` or similar data files, never hard-coded in pages.

## Capabilities and Constraints

- Stack: Astro 5, static build; one codebase builds two sites via `SITE_ID` (triplew | lucharama). Only Triple W is in scope for this redesign; Lucharama must not change.
- Data: `shared/data/roster.json`, `shows.json`, `titles.json`. Pages must keep reading these.
- Hosting: prototypes on Vercel; final on the association's own servers/domains.
- **Planned: English version** (requested 2026-11-16). Design must hold Spanish and English text lengths; internationally the name "WhiteWolf Wrestling" carries more weight.

## Brand Commitments

- The wolf logo stays (a better vector version is coming from Daniel).
- "Triple W" and "WhiteWolf Wrestling" are interchangeable; WhiteWolf Wrestling leads internationally.
- Each show has its own poster identity (e.g. El Bueno, el Malo y el Canalla: western orange; Instinto Animal: jungle blue and fluorescent pink; Top 1: black and acid yellow).
- Orange is the current colour of the prototype, not a confirmed brand commitment.

## Evidence on Hand

- Ringside photography by Daniel: public/triplew/fotos (41 used of 87; map in FOTOS.md), wrestler portraits in public/triplew/luchadores, real posters in public/triplew/carteles.
- Real show list, results and roster from Instagram (partial).
- Absent, must not be invented: official roster bios, title histories, attendance figures, press quotes, international bookings, sponsors. Portraits missing for part of the roster.

## Product Principles

1. The wrestlers are the product: every surface puts faces and characters first.
2. Break the mould of WWE/UFC: spectacle over grid, but the next show and how to attend are never more than one glance away.
3. Self-sufficient: whatever the association changes lives in data, editable from the panel.
4. Built to travel: Spanish first, English-ready, legible to an international booker.
5. Real photography over decoration; never fake content.
