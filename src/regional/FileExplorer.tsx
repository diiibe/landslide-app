import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/ui/Icon";
import { THEMES, filterItems, type CatalogItem, type ThemeId } from "./catalog";
import { isLayerEnabled } from "./builtins";
import styles from "./FileExplorer.module.css";

function collectionName(items: CatalogItem[]) {
  const first = items[0]!.layer;
  if (first.subfolder)
    return first.subfolder
      .replace(
        /^Acqua - Acque di classificazione:\s*(.+)$/i,
        (_, kind: string) => "Acque " + kind.toLocaleLowerCase("it"),
      )
      .replace(/^Aria - /, "");
  if (!/^[A-Z_]+:|^[a-z0-9]{4}-[a-z0-9]{4}$/.test(first.sourceId))
    return first.sourceId;
  const prefix = first.title.split(" · ")[0]!;
  return items.every((i) => i.layer.title.startsWith(prefix + " · "))
    ? prefix
    : first.title + " e altri dati";
}
export function FileExplorer({
  items,
  query,
  renderItem,
  clearQuery,
}: {
  items: CatalogItem[];
  query: string;
  renderItem: (item: CatalogItem) => ReactNode;
  clearQuery: () => void;
}) {
  const id = useId();
  const [theme, setTheme] = useState<ThemeId | null>(null),
    [source, setSource] = useState<string | null>(null),
    [limit, setLimit] = useState(40);
  const searching = !!query.trim();
  const found = searching
    ? filterItems(
        items,
        {
          query,
          theme: "",
          provider: "",
          type: "",
          cadence: "",
          availability: "",
        },
        isLayerEnabled,
      )
    : [];
  const themed = items.filter((i) => i.theme === theme);
  const collections = [
    ...new Set(themed.map((i) => i.layer.subfolder ?? i.layer.sourceId)),
  ].map((key) => ({
    key,
    items: themed.filter(
      (i) => (i.layer.subfolder ?? i.layer.sourceId) === key,
    ),
  }));
  const selectedCollection = collections.find((c) => c.key === source);
  const leaves = (entries: CatalogItem[]) => (
    <>
      {entries.slice(0, limit).map((item) => (
        <div className={styles.leaf} key={item.layer.id}>
          {renderItem(item)}
        </div>
      ))}
      {entries.length > limit && (
        <button className={styles.more} onClick={() => setLimit((v) => v + 40)}>
          Mostra altri {Math.min(40, entries.length - limit)} livelli
        </button>
      )}
    </>
  );
  return (
    <div className={styles.explorer}>
      <nav className={styles.path} aria-label="Percorso del catalogo">
        <button
          onClick={() => {
            setTheme(null);
            setSource(null);
            clearQuery();
          }}
          aria-label="Tutti i dati"
        >
          <Icon name="catalog" />
          <span>Catalogo</span>
        </button>
        {(theme || searching) && <Icon name="chevron" />}
        {searching ? (
          <span aria-current="location">Ricerca globale</span>
        ) : (
          theme && (
            <button
              aria-current={!source ? "location" : undefined}
              onClick={() => setSource(null)}
            >
              {THEMES[theme]}
            </button>
          )
        )}
        {!searching && selectedCollection && (
          <>
            <Icon name="chevron" />
            <span aria-current="location">
              {collectionName(selectedCollection.items)}
            </span>
          </>
        )}
      </nav>
      {searching ? (
        <section
          aria-label="Risultati della ricerca"
          className={styles.searchResults}
        >
          <div className={styles.resultHead}>
            <span role="status">{found.length} livelli trovati</span>
            <button onClick={clearQuery}>Azzera ricerca</button>
          </div>
          {found.length ? (
            leaves(found)
          ) : (
            <p className={styles.empty}>
              Nessun dato corrisponde a «{query}». Prova il nome di un sensore,
              un parametro o una fonte.
            </p>
          )}
        </section>
      ) : (
        <nav aria-label="Cartelle dei dati">
          <ul className={styles.tree}>
            {Object.entries(THEMES).map(([key, label], index) => {
              const entries = items.filter((i) => i.theme === key);
              if (!entries.length) return null;
              const expanded = theme === key,
                groupId = `${id}-theme-${index}`;
              return (
                <li key={key}>
                  <button
                    className={styles.folder}
                    aria-expanded={expanded}
                    aria-controls={groupId}
                    onClick={() => {
                      setTheme(expanded ? null : (key as ThemeId));
                      setSource(null);
                      setLimit(40);
                    }}
                  >
                    <Icon name="chevron" />
                    <Icon name={expanded ? "folderOpen" : "folder"} />
                    <span>{label}</span>
                    <small aria-label={`${entries.length} livelli`}>
                      {entries.length}
                    </small>
                  </button>
                  {expanded && (
                    <div
                      id={groupId}
                      className={styles.branch}
                      role="group"
                      aria-label={label}
                    >
                      {collections.map((collection, groupIndex) => {
                        if (
                          collection.items.length === 1 &&
                          !collection.items[0]!.layer.subfolder
                        )
                          return (
                            <div className={styles.leaf} key={collection.key}>
                              {renderItem(collection.items[0]!)}
                            </div>
                          );
                        const opened = source === collection.key,
                          collectionId = `${groupId}-collection-${groupIndex}`;
                        return (
                          <div key={collection.key}>
                            <button
                              className={`${styles.folder} ${styles.collection}`}
                              aria-expanded={opened}
                              aria-controls={collectionId}
                              onClick={() => {
                                setSource(opened ? null : collection.key);
                                setLimit(40);
                              }}
                            >
                              <Icon name="chevron" />
                              <Icon name={opened ? "folderOpen" : "folder"} />
                              <span>{collectionName(collection.items)}</span>
                              <small
                                aria-label={`${collection.items.length} livelli`}
                              >
                                {collection.items.length}
                              </small>
                            </button>
                            {opened && (
                              <div
                                id={collectionId}
                                className={styles.branch}
                                role="group"
                                aria-label={collectionName(collection.items)}
                              >
                                {leaves(collection.items)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
