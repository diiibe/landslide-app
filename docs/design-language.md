# FVG · Linguaggio visivo

L’interfaccia serve a esplorare il territorio, scegliere dati e leggere osservazioni
anche da telefono. La mappa rimane lo spazio principale; pannelli e strumenti
condividono una gerarchia sobria e leggibile. La struttura del catalogo resta quella
approvata: ricerca, temi, filtri, livelli indipendenti e dettagli contestuali.

I riferimenti consultati sono il route planner di Strava, il planner web di Komoot
e CARTO Builder. Sono riferimenti di composizione e comportamento, non template da
riprodurre. Il sistema visivo è originale per FVG.

## Fondamenti

- Manrope variabile 400–700; corpo 13–14px, metadati 11–12px, titoli16–22px.
- Spaziature4/8/12/16/24/32px, definite in `src/styles/tokens.css`.
- Superficie principale neutra, campo di ricerca leggermente distinto, bordo
  sottile. Il verde identifica azioni e selezioni. I colori dei dati conservano la
  loro scala indipendente dal tema.
- Temi chiaro e scuro con la stessa gerarchia semantica. Testo secondario e
  placeholder mantengono almeno4.5:1 sulle superfici previste.
- Raggi6px per controlli,8px per pannelli,12px per il catalogo. Ombra unica leggera;
  nessuna variazione di dimensione al passaggio del puntatore.
- Controlli principali44px. Le icone sono lineari18px, tratto1.5. I pulsanti solo
  icona hanno nome accessibile e azione esplicita.

## Componenti

`src/ui/Icon.tsx` contiene i simboli condivisi; `SearchField` fornisce ricerca,
focus, svuotamento e ritorno del cursore al campo. Il catalogo focalizza la ricerca
solo dopo l’apertura del dialogo. I controlli di geocodifica conservano il proprio
contratto di autocompletamento e usano gli stessi token visivi.

La navbar è alta64px su desktop. La ricerca e gli strumenti si ridispongono su
due righe su telefono; il menu strumenti mantiene azioni toccabili. Il catalogo
resta l’azione primaria riconoscibile.

Il pannello destro ha intestazione persistente, ricerca, righe compatte dei livelli
attivi, dettaglio e cartelle. I metadati lunghi si troncano solo nelle righe; la
scheda di dettaglio conserva i dati completi. La sua larghezza desktop384px è letta
dalla geometria reale per il padding della camera; il canvas non si restringe.

Il catalogo mantiene filtri e temi separati dai risultati. Le descrizioni possono
occupare due righe nell’elenco; il nome apre la scheda completa. I campi restano
nativi per l’uso da tastiera e touch. In landscape basso i filtri si dispongono
su una riga per lasciare spazio ai risultati.

La legenda mostra prima classi e soglia; la spiegazione estesa si apre con
«Come leggere la mappa». Numeri e didascalie mantengono il contrasto anche per le
classi sotto soglia; si attenuano esclusivamente i campioni di colore.

Sfondo mappa, esportazione, scelta colori e schede sensori adottano gli stessi
bordi, raggi, superfici, focus e gerarchia dei pulsanti. La copia operativa è in
italiano. Gli stati di errore/fonte non diventano decorazioni né simulazioni live.

## Verifica

Verificare build e contratti esistenti, overflow, minimi touch, focus visibile,
Tab/Escape, ricerca dopo clear, temi,320px e landscape, e l’assenza di resize del
canvas durante apertura/chiusura. Rispettare `prefers-reduced-motion`.
