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

## Esplora, tipografia e menu dell’app

Manrope variabile è ospitato in `public/fonts/manrope-variable.woff2` (SIL OFL,
licenza inclusa). Il precaricamento e `fonts.css` eliminano la dipendenza dal
servizio Google Fonts per i controlli. `finish.css` definisce una scala in rem:
12px per metadati, 14px per righe e comandi, 16px per la lettura e gli input touch,
18px per intestazioni del pannello, 24px per il titolo del catalogo.

`FileExplorer` mantiene visibili le cartelle principali e apre raccolte e livelli
con rientri e guide. Usa elenchi e pulsanti di navigazione, senza dichiarare un
ruolo ARIA tree non implementato. Il percorso rende esplicita la posizione; le
azioni sono accessibili da tastiera. La ricerca nel pannello riguarda sempre
l’intero catalogo, conserva il percorso di navigazione e lo ripristina al clear.
Gli errori di caricamento del catalogo hanno un messaggio e un comando di retry.

`Select` sostituisce tutti i picker nativi dell’app con listbox HTML, disegnati con
gli stessi token e lo stesso font. Il menu mantiene la relazione DOM con il
proprio dialogo e usa il top layer del Popover API, con posizionamento ricalcolato
su resize, scroll e visual viewport. Ricerca per le liste lunghe, frecce, Invio,
Escape, Tab e typeahead per quelle brevi sono gestiti esplicitamente. La ricerca
resta editabile durante la navigazione con frecce e durante i refresh del feed.
L’eventuale menu aperto si chiude prima del dialogo che lo contiene.

La colonna usa una base al97% con filtro dello sfondo e una grana SVG appena
percepibile; intestazione, livelli attivi e scheda conservano superfici distinte.
I menu delle opzioni rimangono opachi per evitare che il testo retrostante
competa con la lettura. La ricerca è persistente sotto l’intestazione; padding di
scroll e margine del dettaglio evitano che copra l’elemento selezionato.
Durante il disegno drawer e legenda vengono temporaneamente sospesi e
ripristinati, senza cambiare le preferenze dell’utente. Il menu strumenti si
chiude per lasciare la mappa libera; gli inset della camera si azzerano e si
ripristinano senza cambiare le dimensioni del canvas.

## Componenti centrali: proporzioni e significato

Il catalogo concentra ricerca e comando Filtri sulla stessa riga; le opzioni sono
inizialmente chiuse anche su desktop. L'apertura non azzera query o selezioni e
il comando mantiene il focus quando nasconde i campi. Il numero sul comando
conta soltanto i filtri avanzati applicati, non la categoria o il testo cercato.

Le categorie condividono icone e quattro famiglie cromatiche di orientamento tra
catalogo e albero: terra/energia, acqua/meteo, natura/ambiente, città/reti. Il testo
e la forma dell'icona identificano sempre il tema anche senza colore. Queste
famiglie non sostituiscono i colori delle misure, le classi scientifiche o le
legende. I simboli dei livelli distinguono raster, aree, reti, punti e sensori;
file personali o schemi misti conservano simboli generici senza inventare una
geometria. Il campione di colore originale rimane sul fondo del simbolo.

Nel pannello, il nome e il chevron aprono il dettaglio; l'occhio nella lista
attiva nasconde il livello. Nel catalogo, più e spunta aggiungono o rimuovono il
dato. Le etichette accessibili esplicitano sempre l'azione. Le righe hanno un
passo compatto, i dettagli più respiro; non si estendono le azioni brevi fino a
riempire la riga. Il percorso compare quando indica una navigazione effettiva.
I pulsanti touch conservano44px anche nei tablet oltre768px.

Il movimento si limita alla rotazione del chevron, all'apparizione del ramo e
alla conferma della spunta (tratto disegnato in180ms). Le icone non oscillano e
non si animano dati senza nuove osservazioni. Le preferenze di movimento ridotto
coprono anche questi stati. L'unico sfondo disponibile senza token è indicato
come OpenStreetMap senza mostrare un selettore privo di alternative.

Sotto560px le categorie passano a righe su una colonna: icona, titolo con
sottotitolo e conteggio a destra. I nomi non vengono sillabati per farli entrare
in tessere strette; tablet e landscape ampi possono mantenere due colonne.
