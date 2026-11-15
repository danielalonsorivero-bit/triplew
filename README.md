# Webs de Triple W y Lucharama (prototipo)

Prototipo de las nuevas webs de **Triple W · WhiteWolf Wrestling** (triplew.es) y de su escuela **Lucharama** (lucharama.com). Las dos webs viven en este mismo repositorio y comparten datos y piezas de diseño.

## Cómo está organizado

```
shared/data/        ← EL CONTENIDO. Se edita aquí, no en el diseño.
  shows.json          shows: fecha, sala, color, cartelera y resultados
  roster.json         luchadores, equipos y staff
  titles.json         campeonatos y campeones actuales
  lucharama.json      niveles, horarios, tarifas, seminarios, preguntas frecuentes
shared/components/  ← piezas comunes (hueco de foto, etiqueta "provisional")
sites/triplew/      ← páginas y estilos de triplew.es
sites/lucharama/    ← páginas y estilos de lucharama.com
public/<web>/       ← archivos tal cual (iconos, fotos, carteles)
```

Todo lo que lleva `"provisional": true` en los datos aparece en la web con una etiqueta naranja **PROVISIONAL**. Sirve para que nadie confunda un dato de relleno con uno real. Cuando la Triple W confirme un dato, se cambia y se quita la marca.

## Cómo añadir un show (ejemplo)

Abre `shared/data/shows.json`, copia un bloque de show, cambia `slug` (la dirección: sin espacios ni tildes), `name`, `date` (formato `AAAA-MM-DD`), `venue` (`lucharama` o `revi`), `color` y `ink` (color principal y color oscuro del cartel). Al guardar y subir el cambio, la web se reconstruye sola: el show más cercano pasa a ser la portada y toda la web toma su color.

## Probar en tu ordenador (opcional)

Hace falta [Node.js](https://nodejs.org) 20 o superior.

```
npm install
npm run dev:triplew      # http://localhost:4321
npm run dev:lucharama    # http://localhost:4322
```

## Publicación

- **Vercel (prototipo):** dos proyectos importados desde este repositorio. Los dos usan la misma configuración (`vercel.json`); solo cambia la variable `SITE_ID` (`triplew` o `lucharama`).
- **Servidores de la asociación (final):** `npm run build:triplew` y `npm run build:lucharama` generan `dist/triplew/` y `dist/lucharama/`, con HTML, CSS y JS normales que se pueden subir a cualquier hosting.

## Fuentes del contenido

Webs actuales y perfiles de Instagram @latriplew y @lucharamabytriplew (noviembre de 2026). Fotografía: @wrestlingphotoshow.
