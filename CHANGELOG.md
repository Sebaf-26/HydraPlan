# Changelog

## v1.2.0 — 2026-10-05

- **Planimetrie in PDF**: in *Aggiungi immagine → Dall'alto / planimetria* si può caricare un PDF. L'app mostra le pagine, si sceglie quella giusta e si può ritagliare solo una parte (es. la pianta del piano terra da una tavola con più disegni). Il PDF viene convertito in immagine ad alta risoluzione nel browser (pdf.js, caricato solo quando serve).
- **Scala del disegno**: per i PDF basta indicare la scala (1:100, 1:200…) e la larghezza reale viene calcolata dalle misure del foglio. Per scansioni e foto della tavola resta la calibrazione con una quota nota.
- Il server serve i file `.mjs` (worker di pdf.js) con il tipo MIME corretto.


## v1.1.0 — 2026-10-05

Impianti, piastre e foto.

- **Corrugati e tubi**: nuovo tipo di linea "Corrugato / tubo" con contenuto (elettrico, dati, acqua, irrigazione, scarico, gas, predisposizione), diametro e profondità. È disegnato alla larghezza reale con il colore del contenuto e un'etichetta lungo il tracciato (es. "Ø63 · elettrico · −40 cm"). Anche irrigazione e cavo elettrico hanno la profondità.
- **Pozzetti**: nuovo strumento con formati 20×20 … 60×60, profondità, tipo di chiusino e rotazione, numerati P1, P2…
- **Piastre calpestabili**: nuovo strumento a timbro con formati pronti (40×40, 50×50, 60×60, 40×60, 30×60, Ø40, Ø50), materiale e rotazione. Si ruotano col pallino o con i tasti [ e ].
- **Più immagini sovrapposte** al posto del singolo sfondo: ognuna si può spostare, ruotare, scalare dall'angolo, rendere trasparente, nascondere, riordinare e calibrare. Gli sfondi della v1.0 vengono migrati in automatico.
- **Foto raddrizzate**: da una foto scattata di traverso si indicano 4 angoli di un oggetto di misura nota (piastra, chiusino, foglio A4) e l'app la trasforma in una vista dall'alto in scala da sovrapporre al disegno, con lente d'ingrandimento per posizionare i punti.
- **Foto dei lavori**: ogni oggetto (tubo, pozzetto, aiuola…) può avere foto allegate con data e didascalia, e c'è lo strumento "Foto sul posto" per attaccare foto a un punto della mappa. Dalla foto si può aprire direttamente il raddrizzamento. Le foto (anche HEIC dell'iPhone) vengono convertite in JPEG ridimensionato.
- **Livelli**: si possono mostrare o nascondere immagini, aree, percorsi, impianti interrati, piastre, piante, testi e foto. La scelta è salvata per progetto su ogni dispositivo.
- Il riepilogo mostra anche i metri di tubo per contenuto, i pozzetti e le piastre (numero e m²).
- Server: le immagini non più usate si cancellano dopo 7 giorni, così l'annulla funziona anche dopo averle tolte.


## v1.0.0 — 2026-10-05

Prima versione.

- Progetti multipli (giardino, orto, terrazzo, casa, altro) con duplicazione come "versione".
- Editor in scala in metri: rettangoli e forme libere per le superfici, linee con larghezza reale, quote, etichette, griglia e aggancio, modifica dei vertici, annulla/ripeti, scorciatoie da tastiera, pan/zoom con mouse, trackpad e dita.
- Libreria di circa 50 piante con chioma e altezza da adulte, più specie personalizzate. Per ogni pianta: diametro, data di messa a dimora e note.
- Sfondo da foto o planimetria, oppure dalla vista satellitare Esri già in scala, con calibrazione tramite una misura nota, opacità e spostamento.
- Riepilogo in m² per tipo di superficie e conteggio delle piante; esportazione come immagine con barra di scala.
- Repo pubblico `Sebaf-26/HydraPlan` (era `InfraMap`).
- Login con ADMIN_USERNAME e ADMIN_PASSWORD, dati nel volume `/data`, stack Portainer sulla porta 8094.
