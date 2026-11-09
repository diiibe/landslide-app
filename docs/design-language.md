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
- Quattro palette dell’interfaccia: Bosco, Laguna, Terra e Grafite. Ciascuna ha
  neutrali e accenti coordinati nei temi chiaro e scuro. I colori dei dati
  conservano la loro scala indipendente dalla palette dell’interfaccia.
- Temi chiaro e scuro con la stessa gerarchia semantica. Testo secondario e
  placeholder mantengono almeno4.5:1 sulle superfici previste.
- Raggi6px per controlli,8px per pannelli,12px per i dialoghi. Superfici incassate
  per ricerche e selettori, rialzate per livelli attivi e dettagli; bordo illuminato
  e ombre graduate per separare pannelli e dialoghi dalla mappa. Nessuna variazione
  di dimensione al passaggio del puntatore.
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

## Aspetto e profondità

`src/styles/appearance.css` definisce le otto combinazioni palette/tema e i livelli
`surface-sunken`, `surface-2`, `surface` e `surface-raised`. La luce è applicata alle
intestazioni; le ombre distinguono controlli, pannelli e dialoghi. Non aggiungere
un’ombra a ogni riga del catalogo: la superficie definisce il gruppo, i divisori
mantengono leggibili gli elementi. La selezione combina tinta, bordo e segno di
spunta; il colore non è l’unico indizio.

Il comando «Impostazioni» nella navbar (su telefono dentro «Strumenti») apre un
dialogo nativo con tema, palette e animazioni. Le scelte sono immediate e si salvano
nel dispositivo, in `fvg:appearance`; il tema conserva la chiave `fvg:theme`.
Valori precedenti assenti o non validi ricadono su Bosco e movimento attivo. Se lo
storage è disabilitato la scelta resta valida nella sessione.

## Movimento

Il movimento mostra aperture e conferma selezioni: 180ms per le dissolvenze e
240ms con decelerazione per i dialoghi. I campi e i controlli hanno feedback
cromatico di140ms. Non si animano dimensioni della mappa, padding o geometria del
drawer; l’apertura del pannello usa solo opacità. Il menu strumenti usa una
sola dissolvenza per non alterare il riferimento dei suoi overlay `position:fixed`.
I keyframe di ingresso terminano con `transform:none`.

La preferenza «Animazioni dell’interfaccia» può ridurre il movimento, ma non può
riattivarlo contro `prefers-reduced-motion`. Entrambi i percorsi coprono anche i
fondali nativi `::backdrop`. Nessuna pulsazione continua suggerisce nuove misure o
aggiornamenti dei sensori. I dati e la camera conservano il comportamento esistente.
