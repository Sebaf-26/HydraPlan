# HydraPlan

Planner self-hosted per gli schemi del giardino (e in futuro della casa), sullo stile di Landmarker: si disegna dall'alto **in scala, in metri**, si mettono le piante con la loro chioma reale e si tengono più progetti. Web app React + Vite con un server Node senza dipendenze. Funziona da computer e da telefono e si può installare sulla schermata Home.

## Funzionalità

- **Progetti**: giardino, orto, terrazzo, casa… Ognuno si può **duplicare** per salvarne una versione prima di grandi modifiche.
- **Disegno in scala**: rettangoli e forme libere (prato, aiuola, orto, ghiaia, pavimentazione, deck, acqua, edificio, stanza), linee con larghezza reale (vialetto, siepe, muro, bordura) o sottili (recinzione, irrigazione, cavi), quote ed etichette di testo. Mentre disegni vedi le misure; selezionando un'area ne vedi superficie e perimetro.
- **Modifica**: trascini oggetti e vertici. Trascinando i quadratini a metà di un lato aggiungi un vertice, con doppio clic su un vertice lo togli. Ci sono duplica, blocca, porta sopra/sotto, annulla/ripeti e la griglia con aggancio configurabile (Maiusc lo disattiva al volo).
- **Piante**: una libreria di circa 50 specie (alberi, alberi da frutto, arbusti, siepi, fiori, aromatiche, ortaggi, rampicanti, graminacee) con diametro della chioma e altezza da adulte. Ogni pianta messa nel progetto ha diametro, data di messa a dimora e note. Nella pagina **Libreria piante** puoi aggiungere specie tue o varianti di quelle esistenti.
- **Impianti**: corrugati e tubi con contenuto (elettrico, dati, acqua, irrigazione, scarico, gas, predisposizione), diametro e profondità, colorati per contenuto ed etichettati lungo il tracciato; **pozzetti** con misura, profondità e chiusino. Il riepilogo somma i metri di tubo per contenuto.
- **Piastre calpestabili**: strumento a timbro con formati pronti, materiale e rotazione.
- **Immagini sovrapposte** (quante vuoi): ognuna si sposta, ruota, scala, si rende trasparente o si nasconde. Puoi aggiungere:
  - **planimetria in PDF o immagine**, o foto dall'alto: per i PDF scegli la pagina, ritagli la parte che serve e indichi la scala (1:100) oppure la larghezza reale;
  - **foto da raddrizzare**: una foto scattata di traverso diventa una vista dall'alto in scala. Basta indicare i 4 angoli di qualcosa di cui conosci la misura (una piastra, un chiusino, un foglio A4);
  - **vista satellitare** (Esri World Imagery): cerchi l'indirizzo e inquadri il giardino, già in scala.

  **Calibra con una misura** corregge la scala tracciando una distanza nota.
- **Foto dei lavori** allegate a qualsiasi oggetto o a un punto della mappa (strumento *Foto sul posto*), con data e didascalia: per esempio lo scavo del corrugato prima del rinterro.
- **Livelli** da mostrare o nascondere: immagini, aree, percorsi, impianti interrati, piastre, piante, testi, foto.
- **Riepilogo**: m² per tipo di superficie e conteggio delle piante per specie.
- **Esporta** tutto il progetto come immagine con barra di scala: PNG, oppure JPEG se c'è uno sfondo.

### Comandi

| Tasto | Azione |
|---|---|
| V H R P L A T M | seleziona, sposta vista, rettangolo, forma libera, linea, pianta, testo, quota |
| S O F | piastra, pozzetto, foto sul posto |
| K | calibra l'immagine selezionata |
| [ ] (+Maiusc) | ruota piastra, pozzetto o immagine di 15° (1°) |
| Invio / doppio clic | chiude forma o linea |
| Esc | annulla disegno / deseleziona |
| Canc | elimina selezione |
| ⌘Z / ⇧⌘Z | annulla / ripeti |
| ⌘D | duplica |
| frecce (+Maiusc) | sposta di 10 cm (1 m) |
| + − 0 | zoom / adatta |
| spazio + trascina, rotellina, pinch | muovi e zooma la vista |

## Dati

Tutto sta nel volume `hydraplan-data`:

- `/data/hydraplan.json`: progetti e piante personalizzate;
- `/data/uploads/`: immagini sovrapposte e foto. Quelle che nessun progetto usa più vengono cancellate dopo 7 giorni.

La posizione e lo zoom della vista sono ricordati da ogni dispositivo, non dal server.

**Backup:** `docker cp hydraplan-app:/data ./hydraplan-backup`.

## API

Tutte richiedono il cookie di sessione, tranne `login`, `logout` e `health`.

| Metodo | Path | Note |
|---|---|---|
| `POST` | `/api/login` | `{ username, password }` → cookie valido 30 giorni |
| `POST` | `/api/logout` | |
| `GET` | `/api/plans` | elenco (riassunto) |
| `POST` | `/api/plans` | crea; con `{ fromId, name }` duplica |
| `GET` `PUT` `DELETE` | `/api/plans/:id` | progetto completo |
| `GET` `PUT` | `/api/plants` | piante personalizzate (lista intera) |
| `POST` | `/api/uploads` | corpo = immagine PNG/JPEG/WebP (max 25 MB) → `{ file }` |
| `GET` | `/api/uploads/:file` | |
| `GET` | `/api/tiles/:z/:x/:y` | proxy tile satellitari Esri |
| `GET` | `/api/geocode?q=` | ricerca indirizzi (Nominatim, max 1 richiesta/s) |

## Sviluppo locale

```bash
npm install
DATA_DIR=./data PORT=3000 ADMIN_USERNAME=dev ADMIN_PASSWORD=dev npm start   # API
npm run dev                                                                  # Vite, proxy /api → :3000
```

## Deploy (Portainer + Nginx Proxy Manager)

1. Portainer → **Stacks → Add stack → Repository**:
   - URL `https://github.com/Sebaf-26/HydraPlan`, ref `refs/heads/main`, compose path `docker-compose.yml`.
   - Il repo è pubblico: non serve l'Authentication.
   - Environment variables (vedi [`.env.example`](.env.example)):
     - `ADMIN_USERNAME` e `ADMIN_PASSWORD`: **obbligatorie**, senza il container si ferma. Cambiare la password scollega tutti i dispositivi;
     - `PORT`: default `8094`, uguale dentro e fuori dal container.
2. **Deploy the stack**. Il container si chiama `hydraplan-app`.
3. Nginx Proxy Manager → **Proxy Hosts → Add**: sottodominio → `http`, IP del server, porta `8094`, SSL Let's Encrypt con **Force SSL**. Per le immagini grandi aggiungi in *Advanced* `client_max_body_size 30m;`.

## Prossimamente

- Interni della casa: stanze, muri, porte/finestre, arredi.
