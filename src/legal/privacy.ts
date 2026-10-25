import type { Language } from "../i18n/types";

/**
 * The privacy policy, as the product's own words rather than a link out.
 *
 * Chrome requires the disclosure to live **in the extension's UI** — a policy
 * reachable only through the store listing does not satisfy it. The published
 * page (`docs/privacy/index.html`) is the same policy in long form, published at
 * the public URL both store dashboards ask for — `docs/features.md` records it,
 * and it is not written here: `test/no-network-egress.test.ts` forbids any URL
 * scheme under `src/`, and that guard is worth more than the convenience. The
 * URL is quoted in two store listings, so it moves only at the cost of editing
 * both.
 *
 * This module is the authoritative home of the wording: the panel renders it,
 * and `privacy.test.ts` fails when the published page loses a section this
 * source still claims.
 *
 * ponytail: the page stays hand-written HTML, kept honest by that test. Generate
 * it from this module the day a third surface needs the same text.
 *
 * The egress APIs are named loosely here — "no XHR, no socket, no beacon" — because
 * `test/no-network-egress.test.ts` scans this file among the rest of `src/` and cannot
 * tell prose from a call. The published page spells them out in full, which is where a
 * store reviewer looks for them.
 */
export type PrivacySection = {
  heading: string;
  paragraphs: string[];
};

export type PrivacyPolicy = {
  title: string;
  /** Human-readable effective date, mirroring the published page's own line. */
  effective: string;
  sections: PrivacySection[];
};

/** The only channel a user has to reach a human about this policy. */
export const PRIVACY_CONTACT = "lucas.laurens@proton.me";

const en: PrivacyPolicy = {
  title: "Privacy Policy",
  effective: "Effective 25 October 2026",
  sections: [
    {
      heading: "In one sentence",
      paragraphs: [
        "Carbolate estimates the carbon footprint of your browsing on your own device and sends nothing anywhere. There is no Carbolate server, no account, no analytics, no telemetry, no third party.",
      ],
    },
    {
      heading: "What the extension records",
      paragraphs: [
        "On each page load, one row, updated while the page stays open: the page URL — without its query string or fragment, so a token or an address carried in a link is never kept — and its domain, the number the browser gives its tab so two visits are told apart, the number of network requests and how many of them came from third-party sites (a count only, never which sites), the bytes transferred and the bytes served from cache, the page load duration, the time the page was on screen, the resulting estimated grams of CO₂, and a timestamp to group the row by day.",
        "Those rows live in the browser's local storage on this device. They are never synced across your machines.",
      ],
    },
    {
      heading: "What the extension does not read, and does not send",
      paragraphs: [
        "Not page content, form fields, keystrokes, passwords or cookies. Not the browser's history, its tabs, or your identity.",
        "Carbolate makes no network requests: the code holds no request API — no fetch call, no XHR, no socket, no beacon — and no external address. Nothing is sold, shared or rented — there is no one to transmit it to.",
      ],
    },
    {
      heading: "The permissions it asks for, and why",
      paragraphs: [
        "Site access (<all_urls>): to read the load timings each visited page reports. Estimating a site's weight requires being on that site; the script collects nothing but those measurements.",
        "storage: to write the readings and your settings on the device. unlimitedStorage: to lift the 10 MB cap, so that the “keep everything” window can keep its promise — it grants room, not access. alarms: to run the daily cleanup that applies your retention window. downloads: to write the CSV file when you click Export, never otherwise.",
      ],
    },
    {
      heading: "How long it is kept",
      paragraphs: [
        "You choose. Retention defaults to 1 day: each night, past days are deleted. A longer window keeps them that much longer; “keep everything” deletes nothing.",
      ],
    },
    {
      heading: "How to erase it",
      paragraphs: [
        "Uninstalling Carbolate removes its local storage with it — the browser handles that, nothing is left behind. To erase without uninstalling, set retention to 1 day or use the browser's own clearing tools.",
      ],
    },
    {
      heading: "The CSV export",
      paragraphs: [
        "The Export CSV button writes a file to your downloads folder, holding the same rows as above, URLs included. That file is yours: what happens to it next is in your hands, not ours.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "Carbolate never asks for an age and cannot know one: there is no account and no profile. Since nothing leaves the device, no child's data is collected.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "A version that changed what is recorded, or that added any network egress, would ship with an updated policy and a new effective date. No silent retroactive change.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`A question about this policy: ${PRIVACY_CONTACT}.`],
    },
  ],
};

const fr: PrivacyPolicy = {
  title: "Politique de confidentialité",
  effective: "En vigueur le 25 octobre 2026",
  sections: [
    {
      heading: "En une phrase",
      paragraphs: [
        "Carbolate estime l'empreinte carbone de ta navigation sur ton appareil et n'envoie rien nulle part. Pas de serveur Carbolate, pas de compte, pas d'analytics, pas de télémétrie, pas de tiers.",
      ],
    },
    {
      heading: "Ce que l'extension enregistre",
      paragraphs: [
        "À chaque page chargée, une ligne, mise à jour tant que la page reste ouverte : l'URL de la page — sans ses paramètres ni son ancre, pour qu'un jeton ou une adresse transportés par un lien ne soient jamais conservés — et son domaine, le numéro que le navigateur donne à son onglet pour distinguer deux visites, le nombre de requêtes réseau et combien venaient de sites tiers (un nombre seulement, jamais lesquels), les octets transférés et ceux servis par le cache, la durée de chargement, le temps passé à l'écran, les grammes de CO₂ estimés qui en découlent, et un horodatage pour regrouper par jour.",
        "Ces lignes vivent dans le stockage local du navigateur, sur cet appareil. Elles ne sont jamais synchronisées entre tes machines.",
      ],
    },
    {
      heading: "Ce que l'extension ne lit pas, et n'envoie pas",
      paragraphs: [
        "Ni le contenu des pages, ni les formulaires, ni les frappes clavier, ni les mots de passe, ni les cookies. Ni l'historique du navigateur, ni tes onglets, ni ton identité.",
        "Carbolate n'émet aucune requête réseau : le code ne contient aucune API de requête — ni appel fetch, ni XHR, ni socket, ni beacon — ni aucune adresse externe. Rien n'est vendu, partagé ni loué — il n'y a personne à qui transmettre.",
      ],
    },
    {
      heading: "Les autorisations demandées, et pourquoi",
      paragraphs: [
        "Accès aux sites (<all_urls>) : lire les temps de chargement que chaque page visitée rapporte. Estimer le poids d'un site suppose d'être présent sur ce site ; le script ne collecte que ces mesures.",
        "storage : écrire les relevés et tes réglages sur l'appareil. unlimitedStorage : lever le plafond de 10 Mo, pour que la rétention « tout garder » tienne sa promesse — elle donne de la place, pas un accès. alarms : déclencher le nettoyage quotidien qui applique ta rétention. downloads : écrire le fichier CSV quand tu cliques sur Export, jamais autrement.",
      ],
    },
    {
      heading: "Combien de temps c'est gardé",
      paragraphs: [
        "Tu choisis. La rétention vaut 1 jour par défaut : chaque nuit, les jours passés sont supprimés. Une fenêtre plus longue les conserve d'autant ; « tout garder » ne supprime rien.",
      ],
    },
    {
      heading: "Comment tout effacer",
      paragraphs: [
        "Désinstaller Carbolate supprime son stockage local avec lui — le navigateur s'en charge, il ne reste rien. Effacer sans désinstaller : mets la rétention sur 1 jour, ou passe par les outils du navigateur.",
      ],
    },
    {
      heading: "L'export CSV",
      paragraphs: [
        "Le bouton Export CSV écrit un fichier dans ton dossier de téléchargements, contenant les mêmes lignes que ci-dessus, l'URL comprise. Ce fichier t'appartient : ce qui lui arrive ensuite est entre tes mains, pas les nôtres.",
      ],
    },
    {
      heading: "Enfants",
      paragraphs: [
        "Carbolate ne demande pas d'âge et ne peut pas en connaître un : ni compte, ni profil. Puisque rien ne quitte l'appareil, aucune donnée d'enfant n'est collectée.",
      ],
    },
    {
      heading: "Modifications",
      paragraphs: [
        "Une version qui changerait ce qui est enregistré, ou qui ajouterait une sortie réseau, s'accompagnerait d'une mise à jour de cette politique et d'une nouvelle date d'entrée en vigueur. Aucun changement rétroactif silencieux.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Une question sur cette politique : ${PRIVACY_CONTACT}.`],
    },
  ],
};

export const PRIVACY_POLICY: Record<Language, PrivacyPolicy> = { en, fr };
