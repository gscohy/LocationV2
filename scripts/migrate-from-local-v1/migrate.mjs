// =====================================================================
// Migration loc_local (Prisma v1) → Supabase v2
//
//   node migrate.mjs --dry-run          # n'écrit RIEN dans Supabase
//   node migrate.mjs --apply            # exécute vraiment
//   node migrate.mjs --apply --tables=proprietaires,biens   # filtre
//   node migrate.mjs --apply --resume   # reprend depuis le mapping sauvegardé
//
// Ordre des migrations (respecte les FK) :
//   1. proprietaires            8. contrat_locataires
//   2. biens                    9. loyers
//   3. bien_proprietaires       10. paiements (+ ventilations)
//   4. locataires               11. quittances
//   5. garants                  12. rappels
//   6. locataire_garants        13. charges
//   7. contrats                 14. parametres_smtp (depuis email_configs)
//
// Le mapping ancien_id → nouveau_uuid est sauvegardé dans `.mapping.json`
// après chaque table réussie, pour permettre la reprise.
// =====================================================================

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPPING_FILE = path.join(__dirname, '.mapping.json');

// ---------- args -----------
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const RESUME = args.includes('--resume');
const TABLES_ARG = args.find((a) => a.startsWith('--tables='));
const TABLES_FILTER = TABLES_ARG
  ? TABLES_ARG.replace('--tables=', '').split(',').filter(Boolean)
  : null;

// ---------- env -----------
const LOCAL_DB_URL = process.env.LOCAL_DB_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_USER_ID = process.env.SUPABASE_OWNER_USER_ID;
for (const [k, v] of Object.entries({
  LOCAL_DB_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_OWNER_USER_ID: OWNER_USER_ID,
})) {
  if (!v) {
    console.error(`❌ ${k} manquante dans .env`);
    process.exit(1);
  }
}

// ---------- log helpers -----------
const log = (...a) => console.log(...a);
const ok = (s) => log('✓ ' + s);
const warn = (s) => log('⚠ ' + s);
const info = (s) => log('  ' + s);
const section = (s) => log('\n══ ' + s + ' ══');

log(`Mode : ${DRY_RUN ? '🔍 DRY-RUN (aucune écriture)' : '🚀 APPLY (écritures Supabase)'}`);
if (TABLES_FILTER) log(`Tables : ${TABLES_FILTER.join(', ')}`);
if (RESUME) log('Resume : mapping chargé depuis .mapping.json');

// ---------- connexions -----------
const local = new Client({ connectionString: LOCAL_DB_URL });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- mapping global old_id → new_uuid -----------
/** @type {Record<string, Record<string, string>>} */
const mapping = {
  proprietaires: {},
  biens: {},
  bien_proprietaires: {},
  locataires: {},
  garants: {},
  locataire_garants: {},
  contrats: {},
  contrat_locataires: {},
  loyers: {},
  paiements: {},
  quittances: {},
  rappels: {},
  charges: {},
  // contrats also stores contrat.bien_id and contrat.charges_mensuelles lookup
  // for loyer transformation:
  _contratCharges: {}, // contratId(v1) → charges_mensuelles (number)
};

async function loadMapping() {
  if (!RESUME) return;
  try {
    const raw = await fs.readFile(MAPPING_FILE, 'utf-8');
    Object.assign(mapping, JSON.parse(raw));
    info(`Mapping chargé : ${Object.keys(mapping).length} tables.`);
  } catch {
    warn('Pas de .mapping.json trouvé, on repart de zéro.');
  }
}

async function saveMapping() {
  if (DRY_RUN) return;
  await fs.writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

// ---------- helpers -----------
const newId = () => uuidv4();
const toIso = (v) => (v ? new Date(v).toISOString() : null);
const toDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
const trim = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Insère par batch (Supabase REST accepte un array dans `.insert`). */
async function batchInsert(table, rows, batchSize = 100) {
  if (rows.length === 0) {
    info(`  → ${table} : aucune ligne à insérer`);
    return;
  }
  if (DRY_RUN) {
    info(`  → ${table} : DRY-RUN (${rows.length} lignes prêtes, échantillon ↓)`);
    log(JSON.stringify(rows[0], null, 2));
    return;
  }
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`❌ ${table} batch ${i}-${i + batch.length} :`, error.message);
      console.error('Première ligne du batch fautif :', JSON.stringify(batch[0], null, 2));
      throw error;
    }
    info(`  → ${table} : ${i + batch.length}/${rows.length} insérées`);
  }
}

// =====================================================================
//  Mappings catégoriels (v1 → v2)
// =====================================================================

const CATEGORIE_CHARGE_MAP = {
  CREDIT_IMMO: 'CREDIT_IMMOBILIER',
  CREDIT_IMMOBILIER: 'CREDIT_IMMOBILIER',
  TRAVAUX: 'TRAVAUX',
  ENTRETIEN: 'ENTRETIEN',
  ASSURANCE: 'ASSURANCE_PNO',
  ASSURANCE_PNO: 'ASSURANCE_PNO',
  ASSURANCE_LOYER: 'ASSURANCE_LOYERS_IMPAYES',
  ASSURANCE_LOYERS_IMPAYES: 'ASSURANCE_LOYERS_IMPAYES',
  TAXE_FONCIERE: 'TAXE_FONCIERE',
  TAXE_HABITATION: 'TAXE_HABITATION',
  COPROPRIETE: 'CHARGES_COPROPRIETE',
  CHARGES_COPROPRIETE: 'CHARGES_COPROPRIETE',
  GESTION: 'FRAIS_GESTION',
  FRAIS_GESTION: 'FRAIS_GESTION',
  AGENCE: 'HONORAIRES_AGENCE',
  HONORAIRES_AGENCE: 'HONORAIRES_AGENCE',
  PROCEDURE: 'FRAIS_PROCEDURE',
  FRAIS_PROCEDURE: 'FRAIS_PROCEDURE',
  EAU: 'EAU',
  ELECTRICITE: 'ELECTRICITE',
  GAZ: 'GAZ',
  INTERNET: 'INTERNET',
  EXCEPTIONNELLE: 'EXCEPTIONNELLE',
  AUTRE: 'AUTRE',
};

const TYPE_CONTRAT_MAP = {
  HABITATION: 'HABITATION_VIDE',
  HABITATION_VIDE: 'HABITATION_VIDE',
  MEUBLE: 'HABITATION_MEUBLE',
  HABITATION_MEUBLE: 'HABITATION_MEUBLE',
  MOBILITE: 'MOBILITE',
  ETUDIANT: 'ETUDIANT',
  COMMERCIAL: 'COMMERCIAL',
  PROFESSIONNEL: 'PROFESSIONNEL',
  PARKING: 'PARKING',
  GARAGE: 'GARAGE',
  SAISONNIER: 'SAISONNIER',
};

const STATUT_CONTRAT_MAP = {
  BROUILLON: 'BROUILLON',
  ACTIF: 'ACTIF',
  EXPIRE: 'EXPIRE',
  RENOUVELE: 'RENOUVELE',
  RESILIE: 'RESILIE',
  ARCHIVE: 'ARCHIVE',
};

const TYPE_BIEN_MAP = {
  MAISON: 'MAISON',
  APPARTEMENT: 'APPARTEMENT',
  STUDIO: 'STUDIO',
  LOCAL: 'LOCAL',
  GARAGE: 'GARAGE',
  PARKING: 'PARKING',
  CAVE: 'CAVE',
  TERRAIN: 'TERRAIN',
};

const STATUT_BIEN_MAP = {
  VACANT: 'VACANT',
  LOUE: 'LOUE',
  EN_TRAVAUX: 'EN_TRAVAUX',
  HORS_LOCATION: 'HORS_LOCATION',
};

const STATUT_QUITTANCE_MAP = {
  GENEREE: 'GENEREE',
  ENVOYEE: 'ENVOYEE',
  ANNULEE: 'ANNULEE',
};

// Rappels v1 : type = 'RETARD' (générique) → v2 : RAPPEL_AMIABLE par défaut
const TYPE_RAPPEL_MAP = {
  RETARD: 'RAPPEL_AMIABLE',
  RAPPEL_AMIABLE: 'RAPPEL_AMIABLE',
  RELANCE: 'RELANCE',
  MISE_EN_DEMEURE: 'MISE_EN_DEMEURE',
  COMMANDEMENT_PAYER: 'COMMANDEMENT_PAYER',
  ASSIGNATION: 'ASSIGNATION',
};

// =====================================================================
//  Migrations table par table
// =====================================================================

async function migrateProprietaires() {
  section('proprietaires');
  const { rows } = await local.query('SELECT * FROM public.proprietaires');
  const toInsert = rows.map((r) => {
    const newId_ = newId();
    mapping.proprietaires[r.id] = newId_;
    return {
      id: newId_,
      owner_user_id: OWNER_USER_ID,
      type: r.type ?? 'PHYSIQUE',
      civilite: null,
      nom: r.nom,
      prenom: trim(r.prenom),
      email: r.email,
      telephone_mobile: trim(r.telephone),
      adresse: r.adresse,
      code_postal: r.codePostal,
      ville: r.ville,
      pays: 'France',
      entreprise: trim(r.entreprise),
      siret: trim(r.siret),
      iban: trim(r.numeroRIB),
      // signature : chemin local fichier, on l'ignore (à ré-uploader manuellement)
      signature_data_url: null,
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    };
  });
  await batchInsert('proprietaires', toInsert);
  ok(`proprietaires : ${rows.length} mappés`);
  await saveMapping();
}

async function migrateBiens() {
  section('biens');
  const { rows } = await local.query('SELECT * FROM public.biens');
  const toInsert = rows.map((r) => {
    const newId_ = newId();
    mapping.biens[r.id] = newId_;
    return {
      id: newId_,
      reference: null,
      type: TYPE_BIEN_MAP[r.type] ?? 'AUTRE',
      usage: 'HABITATION',
      adresse: r.adresse,
      complement_adresse: null,
      code_postal: r.codePostal,
      ville: r.ville,
      pays: 'France',
      surface_habitable: r.surface ?? 0,
      nb_pieces: r.nbPieces ?? 1,
      nb_chambres: r.nbChambres ?? 0,
      ascenseur: false,
      description: trim(r.description),
      reglement_interieur: trim(r.reglementInterieur),
      loyer: r.loyer ?? 0,
      charges_mensuelles: r.chargesMensuelles ?? 0,
      depot_garantie: r.depotGarantie ?? 0,
      statut: STATUT_BIEN_MAP[r.statut] ?? 'VACANT',
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    };
  });
  await batchInsert('biens', toInsert);
  ok(`biens : ${rows.length} mappés`);
  await saveMapping();
}

async function migrateBienProprietaires() {
  section('bien_proprietaires');
  const { rows } = await local.query('SELECT * FROM public.bien_proprietaires');
  const toInsert = [];
  for (const r of rows) {
    const bienNew = mapping.biens[r.bienId];
    const proprioNew = mapping.proprietaires[r.proprietaireId];
    if (!bienNew || !proprioNew) {
      warn(`  Skip bp ${r.id} : FK introuvable (bien=${r.bienId}, proprio=${r.proprietaireId})`);
      continue;
    }
    const newId_ = newId();
    mapping.bien_proprietaires[r.id] = newId_;
    toInsert.push({
      id: newId_,
      bien_id: bienNew,
      proprietaire_id: proprioNew,
      quote_part: r.quotePart ?? 100,
    });
  }
  await batchInsert('bien_proprietaires', toInsert);
  ok(`bien_proprietaires : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateLocataires() {
  section('locataires');
  const { rows } = await local.query('SELECT * FROM public.locataires');
  const toInsert = rows.map((r) => {
    const newId_ = newId();
    mapping.locataires[r.id] = newId_;
    const civ = (r.civilite || 'M').toUpperCase();
    const civilite = civ.startsWith('MME') ? 'MME' : civ.startsWith('MLLE') ? 'MLLE' : 'M';
    return {
      id: newId_,
      civilite,
      nom: r.nom,
      prenom: r.prenom,
      date_naissance: toDate(r.dateNaissance) ?? '1900-01-01',
      lieu_naissance: 'Non renseigné',
      email: r.email,
      telephone_mobile: trim(r.telephone) ?? '0000000000',
      adresse_precedente: trim(r.adresse),
      code_postal_precedent: trim(r.codePostal),
      ville_precedente: trim(r.ville),
      profession: trim(r.profession),
      revenus_mensuels: r.revenus ?? null,
      commentaires: r.email2 ? `email2: ${r.email2}` : null,
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    };
  });
  await batchInsert('locataires', toInsert);
  ok(`locataires : ${rows.length} mappés`);
  await saveMapping();
}

async function migrateGarants() {
  section('garants');
  const { rows } = await local.query('SELECT * FROM public.garants');
  const toInsert = rows.map((r) => {
    const newId_ = newId();
    mapping.garants[r.id] = newId_;
    return {
      id: newId_,
      civilite: (r.civilite || 'M').toUpperCase().slice(0, 4),
      nom: r.nom,
      prenom: r.prenom,
      email: r.email,
      telephone: r.telephone || '0000000000',
      adresse: trim(r.adresse),
      code_postal: trim(r.codePostal),
      ville: trim(r.ville),
      profession: trim(r.profession),
      revenus_mensuels: r.revenus ?? null,
      type_garantie: r.typeGarantie || 'PHYSIQUE',
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    };
  });
  await batchInsert('garants', toInsert);
  ok(`garants : ${rows.length} mappés`);
  await saveMapping();
}

async function migrateLocataireGarants() {
  section('locataire_garants');
  const { rows } = await local.query('SELECT * FROM public.locataire_garants');
  const toInsert = [];
  for (const r of rows) {
    const locNew = mapping.locataires[r.locataireId];
    const garNew = mapping.garants[r.garantId];
    if (!locNew || !garNew) {
      warn(`  Skip lg ${r.id} : FK introuvable`);
      continue;
    }
    const newId_ = newId();
    mapping.locataire_garants[r.id] = newId_;
    toInsert.push({ id: newId_, locataire_id: locNew, garant_id: garNew });
  }
  await batchInsert('locataire_garants', toInsert);
  ok(`locataire_garants : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateContrats() {
  section('contrats');
  const { rows } = await local.query('SELECT * FROM public.contrats');
  const toInsert = [];
  for (const r of rows) {
    const bienNew = mapping.biens[r.bienId];
    if (!bienNew) {
      warn(`  Skip contrat ${r.id} : bien_id introuvable (${r.bienId})`);
      continue;
    }
    const newId_ = newId();
    mapping.contrats[r.id] = newId_;
    mapping._contratCharges[r.id] = r.chargesMensuelles ?? 0;
    toInsert.push({
      id: newId_,
      reference: null,
      bien_id: bienNew,
      date_signature: toDate(r.dateDebut),
      date_debut: toDate(r.dateDebut),
      date_fin: toDate(r.dateFin),
      duree_mois: r.duree ?? 36,
      reconduction_tacite: true,
      type: TYPE_CONTRAT_MAP[r.type] ?? 'HABITATION_VIDE',
      usage: 'RESIDENCE_PRINCIPALE',
      loyer: r.loyer ?? 0,
      charges_mensuelles: r.chargesMensuelles ?? 0,
      mode_charges: 'PROVISION_REGULARISATION',
      depot_garantie: r.depotGarantie ?? 0,
      jour_paiement: r.jourPaiement ?? 1,
      mode_paiement: r.modePaiement || 'VIREMENT',
      frais_notaire: r.fraisNotaire ?? 0,
      frais_huissier: r.fraisHuissier ?? 0,
      frais_agence_location: 0,
      clauses_particulieres: trim(r.clausesParticulieres),
      clause_solidarite: false,
      commentaires: trim(r.commentaires),
      statut: STATUT_CONTRAT_MAP[r.statut] ?? 'BROUILLON',
      date_demande_resiliation: toDate(r.dateDemandeResiliation),
      motif_resiliation: trim(r.raisonResiliation),
      commentaires_resiliation: trim(r.commentairesResiliation),
      date_fin_reelle: toDate(r.dateFinReelle),
      preavis_respect: r.preavisRespect ?? null,
      irl_active: false,
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    });
  }
  await batchInsert('contrats', toInsert);
  ok(`contrats : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateContratLocataires() {
  section('contrat_locataires');
  const { rows } = await local.query('SELECT * FROM public.contrat_locataires');
  // Marquer le premier locataire d'un contrat comme principal
  const principalSet = new Set();
  const toInsert = [];
  for (const r of rows) {
    const contratNew = mapping.contrats[r.contratId];
    const locNew = mapping.locataires[r.locataireId];
    if (!contratNew || !locNew) {
      warn(`  Skip cl ${r.id} : FK introuvable`);
      continue;
    }
    const isPrincipal = !principalSet.has(contratNew);
    if (isPrincipal) principalSet.add(contratNew);
    const newId_ = newId();
    mapping.contrat_locataires[r.id] = newId_;
    toInsert.push({
      id: newId_,
      contrat_id: contratNew,
      locataire_id: locNew,
      est_principal: isPrincipal,
    });
  }
  await batchInsert('contrat_locataires', toInsert);
  ok(`contrat_locataires : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateLoyers() {
  section('loyers');
  const { rows } = await local.query('SELECT * FROM public.loyers');
  const toInsert = [];
  for (const r of rows) {
    const contratNew = mapping.contrats[r.contratId];
    if (!contratNew) {
      warn(`  Skip loyer ${r.id} : contrat introuvable`);
      continue;
    }
    const charges = mapping._contratCharges[r.contratId] ?? 0;
    const total = r.montantDu ?? 0;
    const montantLoyer = Math.max(0, total - charges);
    const newId_ = newId();
    mapping.loyers[r.id] = newId_;
    toInsert.push({
      id: newId_,
      contrat_id: contratNew,
      mois: r.mois,
      annee: r.annee,
      montant_loyer: montantLoyer,
      montant_charges: charges,
      // montant_total est calculé (GENERATED) — on ne l'insère pas
      montant_paye: r.montantPaye ?? 0,
      date_echeance: toDate(r.dateEcheance) ?? `${r.annee}-${String(r.mois).padStart(2, '0')}-01`,
      statut: r.statut || 'EN_ATTENTE',
      commentaires: trim(r.commentaires),
      auto_genere_par_surplus: false,
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    });
  }
  await batchInsert('loyers', toInsert);
  ok(`loyers : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migratePaiements() {
  section('paiements (+ ventilations 1-1)');
  const { rows } = await local.query('SELECT * FROM public.paiements');
  const paiementsRows = [];
  const ventilationsRows = [];
  for (const r of rows) {
    const loyerNew = mapping.loyers[r.loyerId];
    if (!loyerNew) {
      warn(`  Skip paiement ${r.id} : loyer introuvable (${r.loyerId})`);
      continue;
    }
    const montant = Number(r.montant);
    if (!montant || montant <= 0) {
      warn(`  Skip paiement ${r.id} : montant nul ou négatif (${r.montant})`);
      continue;
    }
    const paiementId = newId();
    mapping.paiements[r.id] = paiementId;
    paiementsRows.push({
      id: paiementId,
      montant,
      date_reception: toDate(r.date) ?? toDate(r.createdAt) ?? new Date().toISOString().slice(0, 10),
      date_valeur_bancaire: null,
      mode: r.mode || 'VIREMENT',
      payeur: r.payeur || 'Locataire',
      reference: trim(r.reference),
      commentaire: trim(r.commentaire),
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
    });
    ventilationsRows.push({
      id: newId(),
      paiement_id: paiementId,
      loyer_id: loyerNew,
      montant,
    });
  }
  await batchInsert('paiements', paiementsRows);
  await batchInsert('paiement_ventilations', ventilationsRows);
  ok(`paiements : ${paiementsRows.length}/${rows.length} mappés (+ ventilations 1-1)`);
  await saveMapping();
}

async function migrateQuittances() {
  section('quittances');
  const { rows } = await local.query('SELECT * FROM public.quittances');
  const toInsert = [];
  for (const r of rows) {
    const loyerNew = mapping.loyers[r.loyerId];
    if (!loyerNew) {
      warn(`  Skip quittance ${r.id} : loyer introuvable`);
      continue;
    }
    const charges = (() => {
      // Récupérer charges du loyer via lookup — on n'a pas le contratId direct,
      // mais le total = montant. Simplification : on suppose les charges_mensuelles
      // du contrat sont conservées sur le loyer. Si pas, montant_charges=0.
      return 0;
    })();
    const total = r.montant ?? 0;
    const newId_ = newId();
    mapping.quittances[r.id] = newId_;
    toInsert.push({
      id: newId_,
      loyer_id: loyerNew,
      periode: r.periode,
      montant_total: total,
      montant_loyer: total - charges,
      montant_charges: charges,
      date_generation: toIso(r.dateGeneration) ?? new Date().toISOString(),
      date_envoi: toIso(r.dateEnvoi),
      mode_envoi: r.modeEnvoi || 'EMAIL',
      statut: STATUT_QUITTANCE_MAP[r.statut] ?? 'GENEREE',
      email_envoye: r.emailEnvoye ?? false,
    });
  }
  await batchInsert('quittances', toInsert);
  ok(`quittances : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateRappels() {
  section('rappels');
  const { rows } = await local.query('SELECT * FROM public.rappels');
  const toInsert = [];
  for (const r of rows) {
    const loyerNew = mapping.loyers[r.loyerId];
    if (!loyerNew) {
      warn(`  Skip rappel ${r.id} : loyer introuvable`);
      continue;
    }
    const newId_ = newId();
    mapping.rappels[r.id] = newId_;
    toInsert.push({
      id: newId_,
      loyer_id: loyerNew,
      type: TYPE_RAPPEL_MAP[r.type] ?? 'RAPPEL_AMIABLE',
      destinataires: r.destinataires || 'inconnu',
      sujet: 'Rappel de loyer',
      contenu: r.message || '',
      date_envoi_planifie: toDate(r.dateEnvoi),
      date_envoi_effectif: toIso(r.dateEnvoiEffective),
      mode_envoi: r.modeEnvoi || 'EMAIL',
      envoye: r.envoye ?? false,
      commentaires: trim(r.commentaires),
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
    });
  }
  await batchInsert('rappels', toInsert);
  ok(`rappels : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateCharges() {
  section('charges');
  const { rows } = await local.query('SELECT * FROM public.charges');
  const toInsert = [];
  for (const r of rows) {
    const bienNew = mapping.biens[r.bienId];
    if (!bienNew) {
      warn(`  Skip charge ${r.id} : bien introuvable`);
      continue;
    }
    // Type v1 : "MENSUELLE" / "ANNUELLE" / "PONCTUELLE" / etc.
    const isRecurrente = r.type && r.type !== 'PONCTUELLE';
    let freq = null;
    if (isRecurrente) {
      const tu = (r.type || '').toUpperCase();
      if (tu.includes('MENSU')) freq = 'MENSUELLE';
      else if (tu.includes('TRIMES')) freq = 'TRIMESTRIELLE';
      else if (tu.includes('SEMES')) freq = 'SEMESTRIELLE';
      else if (tu.includes('ANNUEL')) freq = 'ANNUELLE';
      else freq = 'MENSUELLE';
    }
    const newId_ = newId();
    mapping.charges[r.id] = newId_;
    toInsert.push({
      id: newId_,
      bien_id: bienNew,
      categorie: CATEGORIE_CHARGE_MAP[r.categorie] ?? 'AUTRE',
      description: r.description || 'Sans description',
      fournisseur: null,
      numero_facture: null,
      montant_ttc: r.montant ?? 0,
      date: toDate(r.date) ?? toDate(r.createdAt) ?? new Date().toISOString().slice(0, 10),
      date_paiement: r.payee ? toDate(r.date) : null,
      type: isRecurrente ? 'RECURRENTE' : 'PONCTUELLE',
      frequence: freq,
      date_debut: toDate(r.dateDebut),
      date_fin: toDate(r.dateFin),
      recuperable: false,
      deductible: true,
      commentaires: trim(r.commentaires),
      preuve_storage_key: null,
      created_at: toIso(r.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
    });
  }
  await batchInsert('charges', toInsert);
  ok(`charges : ${toInsert.length}/${rows.length} mappés`);
  await saveMapping();
}

async function migrateParametresSmtp() {
  section('parametres_smtp (depuis email_configs)');
  const { rows } = await local.query(
    "SELECT * FROM public.email_configs WHERE \"parDefaut\" = TRUE OR \"actif\" = TRUE ORDER BY \"parDefaut\" DESC LIMIT 1",
  );
  if (rows.length === 0) {
    warn('  Aucune email_config par défaut/active.');
    return;
  }
  const r = rows[0];
  const row = {
    id: newId(),
    owner_user_id: OWNER_USER_ID,
    host: r.serveurSMTP || 'smtp.orange.fr',
    port: r.portSMTP ?? 465,
    username: r.email,
    password: r.motDePasse,
    secure: (r.securite || '').toUpperCase() === 'SSL',
    from_email: r.email,
    from_name: r.nom || 'Gestion locative',
    created_at: toIso(r.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(r.updatedAt) ?? new Date().toISOString(),
  };
  if (DRY_RUN) {
    info('  DRY-RUN parametres_smtp :');
    log(JSON.stringify({ ...row, password: '***' }, null, 2));
    return;
  }
  // Upsert pour éviter doublon si déjà saisi via l'UI
  const { error } = await supabase
    .from('parametres_smtp')
    .upsert(row, { onConflict: 'owner_user_id' });
  if (error) {
    console.error('❌ parametres_smtp :', error.message);
    throw error;
  }
  ok('parametres_smtp : 1 ligne upsertée');
}

// =====================================================================
//  Orchestrateur
// =====================================================================

const STEPS = [
  ['proprietaires', migrateProprietaires],
  ['biens', migrateBiens],
  ['bien_proprietaires', migrateBienProprietaires],
  ['locataires', migrateLocataires],
  ['garants', migrateGarants],
  ['locataire_garants', migrateLocataireGarants],
  ['contrats', migrateContrats],
  ['contrat_locataires', migrateContratLocataires],
  ['loyers', migrateLoyers],
  ['paiements', migratePaiements],
  ['quittances', migrateQuittances],
  ['rappels', migrateRappels],
  ['charges', migrateCharges],
  ['parametres_smtp', migrateParametresSmtp],
];

async function main() {
  await local.connect();
  await loadMapping();
  try {
    for (const [name, fn] of STEPS) {
      if (TABLES_FILTER && !TABLES_FILTER.includes(name)) {
        info(`(skip ${name})`);
        continue;
      }
      await fn();
    }
    section('Terminé');
    if (DRY_RUN) {
      log('🔍 Mode DRY-RUN : aucune écriture. Relance avec --apply quand tu es prête.');
    } else {
      log('🚀 Migration appliquée. Mapping sauvegardé dans .mapping.json.');
      log('⚠️  Pense à : 1) ré-uploader la signature des propriétaires via l\'app  2) révoquer la SUPABASE_SERVICE_ROLE_KEY');
    }
  } finally {
    await local.end();
  }
}

main().catch((e) => {
  console.error('❌ Migration interrompue :', e.message);
  console.error(e.stack);
  process.exit(1);
});
