# 🧪 Molecule Lab

**Combiná átomos con tus manos y tu voz.** Un laboratorio de química en el navegador:
nombrás un átomo y aparece en tu mano, lo tirás a un **cuenco de alquimia** en el centro
de la escena y, al mezclar, se forma una molécula real. Todo lo que creás queda en un
**inventario** para volver a usarlo — y las moléculas creadas se pueden combinar entre sí
para descubrir compuestos más complejos. Seguimiento de manos sobre tu webcam, sin
controles ni instalaciones.

🔗 **[Jugar online →](https://damiansire.github.io/web-ar-molecule-lab/)**

![Cuenco de Alquimia](docs/preview.png)

## Cómo se juega

1. Tocá **Activar cámara** y permití el acceso.
2. **Decí el nombre de un átomo** (“hidrógeno”, “oxígeno”…) y aparece en tu mano. Si no
   tenés micrófono, podés agarrarlo de la **paleta** de arriba dejando el dedo encima.
3. **Acercá la mano al cuenco** para soltar adentro lo que sostenés. Repetí para acumular
   (ej. 2 hidrógeno + 1 oxígeno).
4. Decí **“mezclar”** (o dejá el dedo en el botón **✨ Mezclar**) y el cuenco resuelve la
   receta: nace la molécula y entra a tu **inventario**. ¿No reacciona? Ajustá y probá de
   nuevo, o **🗑 Vaciar** para empezar de cero.
5. Lo que ya creaste lo **re-invocás** por voz (“agua”) o sacándolo del **estante** de
   inventario con la mano — y lo podés tirar de vuelta al cuenco como ingrediente.

### El árbol de alquimia

Las moléculas creadas son ingredientes de nuevas recetas. Por ejemplo:

- **Agua** (2 H + 1 O) + **Dióxido de carbono** (1 C + 2 O) → **Ácido carbónico**
- **Amoníaco** (1 N + 3 H) + **Ácido clorhídrico** → **Cloruro de amonio**
- **Dióxido de azufre** + **Agua** → **Ácido sulfuroso**

Primero craftás los intermedios; después los combinás. El inventario es persistente: tu
avance sobrevive a recargar la página.

## Química

- **Elementos (9):** H · O · C · N · S · P · F · Na · Cl
- **Moléculas de 1.er nivel:** H₂O, CO₂, NH₃, CH₄, NaCl, HCl, H₂, O₂, N₂, H₂O₂, O₃, CO,
  NO, SO₂, H₂S, HF, PH₃
- **Compuestos del árbol de alquimia:** H₂CO₃, NH₄Cl, H₂SO₃, NH₄OH

Las combinaciones se resuelven por **identidad de ingrediente**: un átomo o un producto ya
creado. Agregar contenido es declarativo — sumar un elemento, una molécula (con su
geometría) o una receta a `src/chemistry.ts`.

## Privacidad

Todo corre **en tu dispositivo**. El video de la cámara y el modelo de seguimiento de
manos se ejecutan localmente en el navegador — la imagen nunca sale de tu máquina. No se
descarga ni se contacta nada hasta que tocás *Activar cámara*.

## Tecnología

- **Vite + TypeScript**, renderizado en un `<canvas>` 2D sobre la webcam espejada.
- **Seguimiento de manos** con [MediaPipe Tasks Vision](https://developers.google.com/mediapipe),
  corriendo en un Web Worker para que la inferencia nunca bloquee el render.
- **Voz** con la Web Speech API (opcional; el juego funciona completo solo con gestos).
- **Dominio puro y testeado** (`src/chemistry.ts`): elementos, moléculas, recetas y el
  resolutor del cuenco (`brew`) viven sin DOM y se cubren con tests unitarios.
- Una **Content-Security-Policy** estricta inyectada en build acota la red a los CDNs
  imprescindibles para el modelo.

## Desarrollo

```bash
npm install
npm run dev       # dev server en /web-ar-molecule-lab/
npm test          # tests unitarios (chemistry, inventory, voice, hands)
npm run build     # build de producción → dist/
```

> Requiere un navegador con soporte de `getUserMedia` (cámara). El micrófono es opcional y
> solo se usa para nombrar átomos/productos y decir “mezclar”.

## Deploy

Pushear a `master` dispara un workflow de GitHub Actions que buildea el proyecto y publica
`dist/` en GitHub Pages. El `base` de Vite es `/web-ar-molecule-lab/` para que coincida con
el subpath de Pages.
