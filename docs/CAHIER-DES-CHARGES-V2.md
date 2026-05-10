# Cahier des charges — Application de gestion locative v2

> Document de référence métier. Décrit l'ensemble du périmètre fonctionnel, des entités, des champs et des règles. Indépendant de toute stack technique.

---

## 1. Vue d'ensemble

### 1.1 Objectif
Application web de gestion d'un parc locatif personnel ou en SCI, couvrant le cycle complet : du bail à la déclaration fiscale, en passant par la gestion documentaire, les loyers, les rappels, les diagnostics et les charges.

### 1.2 Périmètre cible
- Plusieurs propriétaires (personnes physiques ou morales/SCI) avec gestion d'indivision
- Plusieurs biens (appartements, maisons, garages, parkings, locaux commerciaux…)
- Plusieurs locataires par bail (colocation, bail conjoint)
- Plusieurs garants par locataire
- Tous types de baux (habitation, meublé, commercial, parking, saisonnier)
- Suivi financier complet (loyers, charges, prêts, fiscalité)

### 1.3 Acteurs
| Rôle | Description | Permissions |
|---|---|---|
| ADMIN | Propriétaire principal / titulaire du compte | Tout (CRUD complet, suppression, paramètres) |
| GESTIONNAIRE | Co-propriétaire, conjoint, comptable | CRUD sauf suppression et paramétrage critique |
| LECTEUR | Consultant externe, expert-comptable | Lecture seule, génération de rapports |

### 1.4 Glossaire

| Terme | Définition |
|---|---|
| Bailleur | Propriétaire qui loue le bien |
| Preneur / Locataire | Personne qui occupe le bien |
| Quote-part | Part de propriété d'un bien (en %) en cas d'indivision |
| IRL | Indice de Référence des Loyers (publié trimestriellement par l'INSEE) |
| Quittance | Document remis au locataire attestant le paiement |
| Régularisation des charges | Ajustement annuel entre charges récupérables provisionnées et charges réelles |
| DPE | Diagnostic de Performance Énergétique |
| ERP | État des Risques et Pollutions |
| Bail meublé | Location avec mobilier conforme au décret du 31 juillet 2015 |
| Préavis | Délai légal entre la demande de résiliation et la fin effective du bail |
| Dépôt de garantie | Somme versée à l'entrée pour garantir d'éventuels manquements |
| Vacance locative | Période entre deux locataires |

---

## 2. Module — Propriétaires

### 2.1 Description
Personnes (physiques ou morales) détenant tout ou partie d'un bien.

### 2.2 Champs

| Champ | Type | Obligatoire | Description / Validation |
|---|---|---|---|
| id | UUID/CUID | ✅ | Généré automatiquement |
| type | Enum | ✅ | `PHYSIQUE` ou `MORALE` (SCI, SARL…) |
| civilité | Enum | ⬜ | `M`, `MME`, `MLLE` (si physique) |
| nom | String(100) | ✅ | Nom de famille ou raison sociale |
| prénom | String(100) | ⬜ | Si physique |
| date de naissance | Date | ⬜ | Si physique |
| lieu de naissance | String(100) | ⬜ | Si physique |
| nationalité | String(50) | ⬜ |  |
| email principal | Email | ✅ | Format valide RFC 5322 |
| email secondaire | Email | ⬜ |  |
| téléphone fixe | String(20) | ⬜ | Format international souhaité |
| téléphone mobile | String(20) | ⬜ |  |
| adresse | String(200) | ✅ | Numéro et rue |
| complément d'adresse | String(100) | ⬜ | Bâtiment, étage, appartement |
| code postal | String(5) | ✅ | 5 chiffres |
| ville | String(100) | ✅ |  |
| pays | String(50) | ✅ | Défaut : France |
| entreprise / raison sociale | String(150) | Si MORALE | Nom de la SCI / société |
| forme juridique | String(50) | ⬜ | SCI, SARL, EURL, etc. |
| SIRET | String(14) | Si MORALE | 14 chiffres exactement |
| numéro RCS | String(50) | ⬜ |  |
| numéro RIB / IBAN | String(34) | ⬜ | Pour réception des loyers |
| BIC | String(11) | ⬜ |  |
| signature (image) | Document | ⬜ | Pour les quittances |
| logo (image) | Document | ⬜ | Pour les courriers |
| commentaires | Texte libre | ⬜ |  |
| date création | Timestamp | ✅ | Auto |
| date modification | Timestamp | ✅ | Auto |

### 2.3 Relations
- **Possède** plusieurs **Biens** via `BienProprietaire` avec une `quote-part` (somme = 100% par bien)
- A pu être ajouté par un **User** (audit trail)

### 2.4 Règles métier
- Un propriétaire MORALE doit avoir un SIRET valide (14 chiffres + clé Luhn vérifiable)
- Suppression interdite si associé à un bien actif
- Email unique recommandé (pour identifier facilement)

---

## 3. Module — Biens immobiliers

### 3.1 Description
Bien physique loué ou destiné à la location.

### 3.2 Champs principaux

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| id | UUID/CUID | ✅ |  |
| référence interne | String(50) | ⬜ | Code court (ex: APP01, MAIS-RUE-XYZ) |
| type | Enum | ✅ | `APPARTEMENT`, `MAISON`, `STUDIO`, `LOCAL`, `GARAGE`, `PARKING`, `CAVE`, `TERRAIN` |
| usage | Enum | ✅ | `HABITATION`, `MIXTE`, `PROFESSIONNEL`, `COMMERCIAL` |
| adresse | String(200) | ✅ |  |
| complément d'adresse | String(100) | ⬜ | Bâtiment B, escalier 3, étage 2… |
| code postal | String(5) | ✅ |  |
| ville | String(100) | ✅ |  |
| pays | String(50) | ✅ | Défaut : France |
| surface habitable (m²) | Décimal | ✅ | Loi Boutin pour habitation |
| surface Carrez (m²) | Décimal | ⬜ | Pour copropriété |
| surface du terrain (m²) | Décimal | ⬜ |  |
| nombre de pièces | Entier | ✅ |  |
| nombre de chambres | Entier | ✅ |  |
| nombre de salles de bain | Entier | ⬜ |  |
| étage | Entier | ⬜ |  |
| ascenseur | Booléen | ⬜ |  |
| meublé | Booléen | ⬜ |  |
| balcon / terrasse | Booléen | ⬜ |  |
| place de parking incluse | Booléen | ⬜ |  |
| cave incluse | Booléen | ⬜ |  |
| chauffage type | Enum | ⬜ | `INDIVIDUEL_GAZ`, `INDIVIDUEL_ELEC`, `COLLECTIF`, `POMPE_CHALEUR`, `BOIS`, `AUTRE` |
| eau chaude type | Enum | ⬜ | `INDIVIDUEL`, `COLLECTIF` |
| classe énergie (DPE) | Enum | ⬜ | `A` à `G` |
| classe GES | Enum | ⬜ | `A` à `G` |
| description publique | Texte | ⬜ | Pour annonces |
| règlement intérieur | Texte | ⬜ | Poubelles, stationnement, animaux… |
| loyer hors charges | Décimal | ✅ | Référence pour les baux |
| charges mensuelles récupérables | Décimal | ✅ |  |
| dépôt de garantie | Décimal | ✅ |  |
| statut | Enum | ✅ | `VACANT`, `LOUE`, `TRAVAUX`, `INDISPONIBLE`, `VENDU` |
| photo principale | Document | ⬜ |  |
| date création | Timestamp | ✅ | Auto |

### 3.3 Informations d'achat (pour rentabilité et fiscalité)

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| date d'achat | Date | ⬜ |  |
| prix d'achat | Décimal | ⬜ | Hors frais |
| frais de notaire | Décimal | ⬜ |  |
| frais d'agence (achat) | Décimal | ⬜ |  |
| travaux initiaux | Décimal | ⬜ | Avant mise en location |
| valeur estimée actuelle | Décimal | ⬜ | Réévaluation périodique |

### 3.4 Lots (pour copropriété ou bien complexe)
Sous-éléments d'un bien (lot d'habitation, parking, cave…)

| Champ | Type | Description |
|---|---|---|
| numéro de lot | String | ex: "Lot 12" |
| description | String |  |
| surface | Décimal |  |
| usage | Enum | `HABITATION`, `PARKING`, `CAVE`, `LOCAL`, `JARDIN` |
| tantièmes copropriété | Entier | Pour les charges |

### 3.5 Relations
- **Appartient** à 1 ou plusieurs **Propriétaires** avec une **quote-part**
- **Comporte** plusieurs **Lots**
- **Est lié à** plusieurs **Contrats** (historique)
- **Comporte** plusieurs **Diagnostics**, **Charges**, **Prêts**, **Documents**

### 3.6 Règles métier
- La somme des quote-parts des propriétaires doit être de 100%
- Le statut passe automatiquement à `LOUE` à la création d'un contrat actif
- Le statut passe à `VACANT` à la résiliation du contrat (sauf nouveau bail enchaîné)
- Suppression interdite si présence de contrats (archivage uniquement)

---

## 4. Module — Locataires

### 4.1 Champs

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| id | UUID/CUID | ✅ |  |
| civilité | Enum | ✅ | `M`, `MME`, `MLLE` |
| nom | String(100) | ✅ | Nom de famille |
| nom de naissance | String(100) | ⬜ | Si différent (femme mariée) |
| prénom | String(100) | ✅ |  |
| autres prénoms | String(150) | ⬜ |  |
| date de naissance | Date | ✅ | Pour le bail |
| lieu de naissance | String(100) | ✅ |  |
| pays de naissance | String(50) | ⬜ |  |
| nationalité | String(50) | ⬜ |  |
| numéro pièce d'identité | String(30) | ⬜ | CNI / Passeport |
| type pièce d'identité | Enum | ⬜ | `CNI`, `PASSEPORT`, `TITRE_SEJOUR` |
| email | Email | ✅ |  |
| téléphone mobile | String(20) | ✅ |  |
| téléphone fixe | String(20) | ⬜ |  |
| adresse précédente | String(200) | ⬜ | Avant location |
| code postal précédent | String(5) | ⬜ |  |
| ville précédente | String(100) | ⬜ |  |
| profession | String(100) | ⬜ |  |
| employeur | String(150) | ⬜ |  |
| type contrat travail | Enum | ⬜ | `CDI`, `CDD`, `INTERIM`, `INDEPENDANT`, `FONCTIONNAIRE`, `RETRAITE`, `ETUDIANT`, `AUTRE` |
| date d'embauche | Date | ⬜ |  |
| revenus mensuels nets | Décimal | ⬜ | Pour vérifier solvabilité |
| autres revenus | Décimal | ⬜ | APL, allocations… |
| situation matrimoniale | Enum | ⬜ | `CELIBATAIRE`, `MARIE`, `PACS`, `DIVORCE`, `VEUF` |
| nombre d'enfants à charge | Entier | ⬜ |  |
| numéro CAF / allocataire | String(20) | ⬜ |  |
| commentaires | Texte | ⬜ |  |
| date création | Timestamp | ✅ |  |

### 4.2 Relations
- **Signe** plusieurs **Contrats** via `ContratLocataire` (avec un drapeau "principal")
- **Présente** plusieurs **Garants** via `LocataireGarant`
- **Possède** plusieurs **Documents** (CNI, fiches de paie, justificatif de domicile précédent…)

### 4.3 Documents typiques attachés
- Pièce d'identité (CNI/Passeport)
- 3 dernières fiches de paie
- Avis d'imposition (1 ou 2 dernières années)
- Justificatif de domicile précédent
- Attestation employeur ou contrat de travail
- RIB

---

## 5. Module — Garants

### 5.1 Champs
Identiques au locataire (même structure : nom, prénom, naissance, profession, revenus, pièce d'identité…), avec en plus :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| type de garantie | Enum | ✅ | `PHYSIQUE`, `MORALE`, `VISALE`, `CAUTION_BANCAIRE`, `GARANTIE_LOCAPASS`, `AUTRE` |
| montant maximum garanti | Décimal | ⬜ | Plafond |
| durée de l'engagement | Enum | ⬜ | `BAIL_INITIAL`, `INDETERMINEE`, `DUREE_FIXE` |
| date fin engagement | Date | ⬜ | Si durée fixe |
| numéro Visale (si applicable) | String(50) | ⬜ |  |
| organisme garant | String(150) | ⬜ | Banque, État, etc. |

### 5.2 Documents typiques
- Acte de cautionnement signé
- Pièce d'identité
- Fiches de paie ou avis d'imposition
- Justificatif de domicile

---

## 6. Module — Contrats de bail

### 6.1 Champs principaux

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| id | UUID | ✅ |  |
| référence interne | String(50) | ⬜ | ex: BAIL-2026-001 |
| bien | FK Bien | ✅ |  |
| locataires | Liste | ✅ | Au moins 1 ; un est marqué "principal" |
| date de signature | Date | ✅ |  |
| date de prise d'effet (début) | Date | ✅ |  |
| date de fin prévue | Date | ⬜ | Vide = bail en cours |
| durée (mois) | Entier | ✅ | 36 (nu), 12 (meublé), 9 (étudiant)… |
| reconduction tacite | Booléen | ✅ | Défaut : selon type |
| type de bail | Enum | ✅ | `HABITATION_VIDE`, `HABITATION_MEUBLE`, `MOBILITE`, `ETUDIANT`, `COMMERCIAL`, `PROFESSIONNEL`, `PARKING`, `GARAGE`, `SAISONNIER` |
| usage | Enum | ✅ | `RESIDENCE_PRINCIPALE`, `RESIDENCE_SECONDAIRE`, `MIXTE` |
| loyer hors charges | Décimal | ✅ |  |
| charges mensuelles | Décimal | ✅ | Provisions sur charges |
| mode de charges | Enum | ✅ | `PROVISION_REGULARISATION`, `FORFAIT` |
| dépôt de garantie | Décimal | ✅ | 1 mois (vide), 2 mois (meublé) |
| date encaissement DG | Date | ⬜ |  |
| jour de paiement exigible | Entier (1-31) | ✅ |  |
| mode de paiement | Enum | ✅ | `VIREMENT`, `PRELEVEMENT`, `CHEQUE`, `ESPECES`, `CAF_DIRECTE`, `MIXTE` |
| frais de notaire | Décimal | ⬜ | Si bail notarié |
| frais d'huissier | Décimal | ⬜ | Si EDL par huissier |
| frais d'agence (location) | Décimal | ⬜ | Honoraires de mise en location |
| zone géographique | Enum | ⬜ | `TENDUE`, `NON_TENDUE` (impacte encadrement loyer) |
| encadrement loyer applicable | Booléen | ⬜ |  |
| loyer de référence | Décimal | ⬜ |  |
| loyer de référence majoré | Décimal | ⬜ |  |
| complément de loyer | Décimal | ⬜ | Si justifié |

### 6.2 Indexation IRL

| Champ | Type | Description |
|---|---|---|
| indexation IRL active | Booléen | Le bailleur peut-il / souhaite-t-il indexer ? |
| trimestre IRL de référence | Entier (1-4) | Trimestre de référence à la signature |
| année IRL de référence | Entier | ex: 2025 |
| valeur IRL de référence | Décimal | Valeur de l'indice à la signature |
| date prochaine révision | Date | Auto-calculée (1 an après signature) |
| mois anniversaire de révision | Entier | 1-12 |

### 6.3 Clauses

| Champ | Type | Description |
|---|---|---|
| clauses particulières | Texte long | Animaux, fumeurs, sous-location… |
| clause résolutoire | Texte | Conditions de résiliation de plein droit |
| clause de solidarité | Booléen | Pour colocation |
| commentaires internes | Texte | Notes du bailleur (privées) |

### 6.4 État des lieux

| Champ | Type | Description |
|---|---|---|
| EDL d'entrée | Référence à `EtatLieux` | Date, document signé, par huissier ou non |
| EDL de sortie | Référence | Si bail terminé |

### 6.5 Résiliation / Fin

| Champ | Type | Description |
|---|---|---|
| statut | Enum | `BROUILLON`, `ACTIF`, `EXPIRE`, `RENOUVELE`, `RESILIE`, `ARCHIVE` |
| date demande résiliation | Date |  |
| auteur résiliation | Enum | `BAILLEUR`, `LOCATAIRE`, `JUDICIAIRE` |
| motif résiliation | Enum | `VENTE`, `REPRISE`, `CONGE_LOCATAIRE`, `IMPAYE`, `TROUBLE_VOISINAGE`, `AUTRE` |
| commentaires résiliation | Texte |  |
| date fin réelle | Date | Effective |
| préavis respecté | Booléen |  |
| date restitution DG | Date |  |
| montant DG restitué | Décimal |  |
| retenues sur DG | Liste (description, montant) |  |

### 6.6 Documents typiques
- Bail signé (PDF)
- Annexe technique (DPE, plomb, amiante, ERP…)
- État des lieux d'entrée
- État des lieux de sortie
- Avenants éventuels (révision IRL, changement de locataire…)
- Acte de cautionnement
- Notice d'information du locataire

### 6.7 Règles métier
- Si bail meublé, le DG max = 2 mois de loyer hors charges (loi)
- Si bail vide, DG max = 1 mois (loi)
- Préavis locataire : 1 mois (zone tendue ou meublé), 3 mois sinon
- Préavis bailleur : 6 mois minimum, motif obligatoire
- Reconduction tacite par défaut sauf loi autre
- Création du contrat → bien passe en `LOUE` automatiquement
- Résiliation → bien passe en `VACANT` (à confirmer après EDL sortie)

---

## 7. Module — Loyers (échéances mensuelles)

### 7.1 Description
Une ligne par mois et par contrat, générée automatiquement.

### 7.2 Champs

| Champ | Type | Description |
|---|---|---|
| id | UUID |  |
| contrat | FK |  |
| mois | Entier (1-12) |  |
| année | Entier (4 chiffres) |  |
| montant loyer hors charges dû | Décimal |  |
| montant charges dû | Décimal |  |
| montant total dû | Décimal | Loyer + charges |
| date d'échéance | Date | Selon `jourPaiement` du contrat |
| montant total payé | Décimal | Somme des paiements ventilés |
| solde restant dû | Décimal | Calculé |
| statut | Enum | `EN_ATTENTE`, `PARTIEL`, `PAYE`, `RETARD`, `IMPAYE`, `ANNULE` |
| date de paiement complet | Date | Quand statut passe à PAYE |
| commentaires | Texte |  |

### 7.3 Règles métier
- Génération automatique le 1er de chaque mois pour tous les contrats `ACTIF`
- Le montant dû peut être ajusté manuellement (cas particuliers : 1er mois au prorata, départ en cours de mois)
- Statut recalculé automatiquement après chaque paiement
- Bascule en `RETARD` si la date d'échéance est dépassée et solde > 0
- Bascule en `IMPAYE` après 60 jours de retard
- Une quittance ne peut être générée que si statut = `PAYE`

---

## 8. Module — Paiements

### 8.1 Description
Encaissement effectif, pouvant être ventilé sur un ou plusieurs loyers (cas CAF qui paie 3 mois en une fois).

### 8.2 Champs

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| id | UUID | ✅ |  |
| montant total | Décimal | ✅ | Somme reçue |
| date de réception | Date | ✅ |  |
| date de valeur bancaire | Date | ⬜ |  |
| mode | Enum | ✅ | `VIREMENT`, `CHEQUE`, `ESPECES`, `CAF`, `PRELEVEMENT`, `PAYLIB`, `AUTRE` |
| payeur | String | ✅ | "Locataire", "CAF", "Action Logement", "Famille X"… |
| référence | String(100) | ⬜ | N° chèque, libellé virement |
| commentaire | Texte | ⬜ |  |
| ventilations | Liste | ✅ | Au moins 1, somme = montant total |
| date saisie | Timestamp | ✅ |  |
| saisi par | FK User | ✅ |  |

### 8.3 Ventilation (sous-élément)

| Champ | Type | Description |
|---|---|---|
| loyer ciblé | FK Loyer |  |
| montant affecté | Décimal |  |

### 8.4 Cas d'usage exemple
**Janvier 2026** : loyer dû = 700 €
- 5 janvier : 150 € reçu du locataire (référence virement)
- 25 janvier : 30 € reçu des parents (chèque)
- 5 mars : 600 € reçu de la CAF (rétroactif sur janvier + février)
  - Ventilation : 520 € sur janvier (solde) + 80 € sur février

→ Loyer janvier passe en `PAYE` le 5 mars (date du dernier paiement comblant le dû)

---

## 9. Module — Quittances

### 9.1 Champs

| Champ | Type | Description |
|---|---|---|
| id | UUID |  |
| loyer associé | FK |  |
| période | String | "Janvier 2026" |
| montant total | Décimal | Loyer + charges |
| montant loyer | Décimal | Détail |
| montant charges | Décimal | Détail |
| date de génération | Date |  |
| date d'envoi | Date |  |
| mode d'envoi | Enum | `EMAIL`, `COURRIER`, `LETTRE_RAR`, `MAIN_PROPRE` |
| destinataires email | Liste |  |
| statut | Enum | `GENEREE`, `ENVOYEE`, `ANNULEE` |
| document PDF généré | FK Document |  |
| journal d'envoi | Liste | Historique tentatives, succès, échec |

### 9.2 Mentions obligatoires sur le PDF
- Identité bailleur (nom, adresse)
- Identité locataire (nom, adresse du bien)
- Période concernée (mois et année)
- Détail : loyer + charges
- Mention "loyer payé / quittance valant reçu"
- Date de paiement
- Signature ou cachet

### 9.3 Règles
- Génération impossible si loyer non `PAYE`
- Une seule quittance valable par loyer (les autres sont `ANNULEE`)
- Envoi automatique configurable (par défaut, manuel)

---

## 10. Module — Charges bailleur

### 10.1 Description
Toutes les dépenses du propriétaire (récupérables ou non sur le locataire, déductibles ou non fiscalement).

### 10.2 Champs

| Champ | Type | Description |
|---|---|---|
| id | UUID |  |
| bien | FK |  |
| catégorie | Enum | `TRAVAUX`, `ENTRETIEN`, `ASSURANCE_PNO`, `ASSURANCE_LOYERS_IMPAYES`, `CREDIT_IMMOBILIER`, `TAXE_FONCIERE`, `TAXE_HABITATION`, `CHARGES_COPROPRIETE`, `FRAIS_GESTION`, `HONORAIRES_AGENCE`, `FRAIS_PROCEDURE`, `EAU`, `ELECTRICITE`, `GAZ`, `INTERNET`, `EXCEPTIONNELLE`, `AUTRE` |
| sous-catégorie | String | ex pour TRAVAUX : "Plomberie", "Peinture"… |
| description | Texte |  |
| fournisseur | String | Nom de l'artisan, syndic, etc. |
| numéro de facture | String |  |
| montant TTC | Décimal |  |
| montant HT | Décimal |  |
| TVA | Décimal |  |
| date de la dépense | Date |  |
| date de paiement | Date |  |
| mode de paiement | Enum |  |
| type | Enum | `PONCTUELLE`, `RECURRENTE` |
| fréquence | Enum (si récurrente) | `MENSUELLE`, `TRIMESTRIELLE`, `SEMESTRIELLE`, `ANNUELLE` |
| date de début | Date | Pour récurrente |
| date de fin | Date | Pour récurrente |
| récupérable sur locataire | Booléen | Selon décret n°87-713 |
| déductible fiscalement | Booléen | Pour 2044 |
| ligne 2044 | Enum | `LIGNE_224` (dépenses récup), `LIGNE_226` (réparations…), etc. |
| commentaires | Texte |  |
| documents | Liste FK | Factures, devis |

### 10.3 Charges récupérables types
- Eau et chauffage collectifs
- Entretien parties communes
- Taxe d'enlèvement ordures ménagères
- Petits entretiens (sauf vétusté)

### 10.4 Charges déductibles fiscales (régime réel)
- Intérêts d'emprunt
- Assurances (PNO, GLI)
- Travaux d'entretien et réparation (sauf travaux d'amélioration)
- Frais de gestion et procédure
- Taxe foncière (hors TEOM)
- Provisions pour charges de copropriété

---

## 11. Module — Prêts immobiliers

### 11.1 Champs principaux

| Champ | Type | Description |
|---|---|---|
| id | UUID |  |
| bien | FK |  |
| nom | String | "Prêt acquisition appartement Lyon" |
| banque | String |  |
| numéro de prêt | String |  |
| type | Enum | `AMORTISSABLE`, `IN_FINE`, `RELAIS`, `PEL`, `CEL`, `PTZ` |
| montant emprunté | Décimal |  |
| taux d'intérêt nominal | Décimal | en % annuel |
| TAEG | Décimal | Taux annuel effectif global |
| durée (mois) | Entier |  |
| date de début | Date |  |
| date de fin prévue | Date |  |
| date de premier versement | Date | Si différé |
| mensualité hors assurance | Décimal |  |
| mensualité assurance | Décimal |  |
| mensualité totale | Décimal |  |
| organisme assurance | String |  |
| taux assurance | Décimal | en % du capital |
| capital restant dû actuel | Décimal | Mis à jour |
| statut | Enum | `EN_COURS`, `SOLDE`, `RACHETE`, `SUSPENDU` |
| date de rachat | Date |  |
| commentaires | Texte |  |
| documents | Liste | Offre de prêt, contrat, échéancier… |

### 11.2 Échéances de prêt
Une ligne par échéance.

| Champ | Type | Description |
|---|---|---|
| rang | Entier | 1, 2, 3… |
| date d'échéance | Date |  |
| montant total échéance | Décimal |  |
| capital amorti | Décimal |  |
| intérêts | Décimal | Déductibles fiscalement |
| assurance | Décimal | Déductible |
| frais accessoires | Décimal |  |
| capital restant dû après | Décimal |  |
| statut | Enum | `A_VENIR`, `PAYEE`, `EN_RETARD`, `IMPAYEE` |

### 11.3 Import facilité
Possibilité d'importer un échéancier XLS/CSV fourni par la banque.

---

## 12. Module — Diagnostics obligatoires

### 12.1 Description
Documents techniques exigés par la loi à la signature du bail (et joints en annexe).

### 12.2 Types et durées de validité

| Type | Code | Validité | Obligatoire pour |
|---|---|---|---|
| Diagnostic de Performance Énergétique | DPE | 10 ans | Tous baux d'habitation |
| Constat de Risque d'Exposition au Plomb | CREP | 6 ans (ou illimitée si négatif) | Logements antérieurs à 1949 |
| État relatif à l'amiante | AMIANTE | Illimitée si négatif | Permis de construire avant 1997 |
| État de l'installation intérieure d'électricité | DIAG_ELEC | 6 ans | Installation > 15 ans |
| État de l'installation intérieure de gaz | DIAG_GAZ | 6 ans | Installation > 15 ans |
| État des Risques et Pollutions | ERP | 6 mois | Tous les biens |
| Diagnostic bruit | BRUIT | Illimitée | Zones de bruit aérien |
| Audit énergétique | AUDIT | 5 ans | Vente F/G depuis 2023 |
| Mesurage Carrez | CARREZ | Illimitée | Lots en copropriété |
| Mesurage Boutin | BOUTIN | Illimitée | Logements loués |
| Termites | TERMITES | 6 mois | Zones à risques (arrêté préfectoral) |
| Assainissement non collectif | ASSAINISSEMENT | 3 ans | Maisons hors tout-à-l'égout |

### 12.3 Champs par diagnostic

| Champ | Type |
|---|---|
| bien | FK |
| type | Enum (cf. tableau) |
| date de réalisation | Date |
| date d'expiration | Date | Auto-calculée selon le type |
| organisme / diagnostiqueur | String |
| numéro de certification | String |
| résultat | String | "Classe D", "Négatif", etc. |
| valeur clé (DPE) | Décimal | kWh/m²/an |
| émissions GES (DPE) | Décimal | kgCO2/m²/an |
| coût estimé | Décimal | Du diagnostic |
| document PDF | FK Document |
| commentaires | Texte |

### 12.4 Alertes
- Notification 90 jours avant expiration
- Notification 30 jours avant expiration
- Notification le jour J
- Tableau de bord : liste des diagnostics expirant dans les 6 mois

---

## 13. Module — Indexation IRL & révisions de loyer

### 13.1 Indices IRL
Référentiel publié trimestriellement par l'INSEE.

| Champ | Type |
|---|---|
| trimestre | Entier (1-4) |
| année | Entier |
| valeur de l'indice | Décimal |
| variation annuelle | Décimal | en % |
| date de publication | Date |

### 13.2 Révisions de loyer

| Champ | Type | Description |
|---|---|---|
| contrat | FK |  |
| date de révision | Date | Anniversaire du bail |
| ancien loyer hors charges | Décimal |  |
| nouveau loyer hors charges | Décimal |  |
| montant de la revalorisation | Décimal |  |
| pourcentage de revalorisation | Décimal |  |
| trimestre IRL référence | Entier |  |
| année IRL référence | Entier |  |
| valeur IRL référence | Décimal |  |
| trimestre IRL nouveau | Entier |  |
| année IRL nouvelle | Entier |  |
| valeur IRL nouvelle | Décimal |  |
| courrier de notification | FK Document | Généré automatiquement |
| date d'envoi | Date |  |
| accepté par locataire | Booléen |  |
| date d'application effective | Date |  |

### 13.3 Calcul
Nouveau loyer = ancien loyer × (IRL nouveau / IRL référence)

### 13.4 Règles
- Révision impossible si bouclier loyer en vigueur (vérification réglementaire)
- Révision proposable seulement si la clause est dans le bail
- À effectuer dans l'année qui suit la date anniversaire (sinon prescrite)

---

## 14. Module — État des lieux

### 14.1 Champs

| Champ | Type | Description |
|---|---|---|
| contrat | FK |  |
| type | Enum | `ENTREE`, `SORTIE` |
| date | Date |  |
| heure | String | HH:MM |
| réalisé par | Enum | `BAILLEUR`, `MANDATAIRE`, `HUISSIER` |
| nom du tiers | String | Si huissier ou agence |
| frais d'huissier | Décimal | À répartir 50/50 légalement |
| présent locataire | Booléen |  |
| présent bailleur | Booléen |  |
| signé par les parties | Booléen |  |
| compteur électricité (entrée + sortie) | Décimal |  |
| compteur eau froide | Décimal |  |
| compteur eau chaude | Décimal |  |
| compteur gaz | Décimal |  |
| nombre clés remises | Entier |  |
| pièces (liste) | Liste | État de chaque pièce (sol, mur, plafond, équipements) |
| photos | Liste FK Document |  |
| document signé | FK Document |  |
| commentaires | Texte |  |

### 14.2 Pour l'EDL de sortie
Comparaison avec l'EDL d'entrée → liste des dégradations imputables au locataire → retenue sur DG.

---

## 15. Module — Rappels / Relances

### 15.1 Types

| Type | Délai après échéance | Action |
|---|---|---|
| RAPPEL_AMIABLE | J+5 | Email simple |
| RELANCE | J+15 | Email + courrier |
| MISE_EN_DEMEURE | J+30 | Lettre recommandée AR |
| COMMANDEMENT_PAYER | J+60 | Acte d'huissier |
| ASSIGNATION | J+90+ | Procédure judiciaire |

### 15.2 Champs

| Champ | Type |
|---|---|
| loyer concerné | FK |
| type | Enum |
| date d'envoi planifié | Date |
| date d'envoi effectif | Date |
| mode d'envoi | Enum (`EMAIL`, `COURRIER_SIMPLE`, `LRAR`, `HUISSIER`) |
| destinataires | Liste |
| modèle utilisé | FK EmailTemplate |
| sujet | String |
| contenu | Texte |
| envoyé | Booléen |
| frais engagés | Décimal | (LRAR, huissier) |
| document PDF | FK |
| commentaires | Texte |

### 15.3 Automatisation
- Job CRON quotidien qui détecte les loyers en retard et planifie les rappels
- Validation manuelle obligatoire avant envoi des MISE_EN_DEMEURE et au-delà

---

## 16. Module — Documents

### 16.1 Description
Stockage centralisé de tous les fichiers (PDF, images, documents Word…).

### 16.2 Champs

| Champ | Type | Description |
|---|---|---|
| id | UUID |  |
| nom original | String |  |
| nom stocké | String | Clé unique (UUID + extension) |
| chemin de stockage | String | URL S3 ou clé MinIO |
| bucket | String |  |
| taille (octets) | Entier |  |
| type MIME | String | `application/pdf`, `image/jpeg`… |
| extension | String |  |
| somme de contrôle | String | SHA-256 pour intégrité |
| catégorie | Enum | `CONTRAT`, `LOCATAIRE`, `GARANT`, `BIEN`, `CHARGE`, `PRET`, `QUITTANCE`, `DIAGNOSTIC`, `ETAT_LIEUX`, `COURRIER`, `ASSURANCE`, `AUTRE` |
| type de document | String | "Bail", "CNI", "Fiche paie", "Photo", "Facture EDF"… |
| description | Texte |  |
| relations | Refs | bienId, contratId, locataireId, garantId, chargeId, pretId (optionnels selon contexte) |
| uploadé par | FK User |  |
| date upload | Timestamp |  |
| supprimable | Booléen | Faux pour quittances générées |

### 16.3 Règles
- Validation magic-number côté serveur (PDF, JPEG, PNG, WEBP, DOCX, XLSX, TXT)
- Taille max : 25 Mo
- Visualisation via URL signée temporaire (1h)
- Soft-delete recommandé (purger seulement après 2 ans)

---

## 17. Module — Vacance locative

### 17.1 Champs

| Champ | Type | Description |
|---|---|---|
| bien | FK |  |
| date de début | Date | Lendemain fin du dernier bail |
| date de fin | Date | Veille du nouveau bail (vide si toujours vacant) |
| durée en jours | Entier | Auto-calculée |
| raison | Enum | `RECHERCHE_LOCATAIRE`, `TRAVAUX`, `INDISPONIBILITE_VOLONTAIRE`, `MISE_EN_VENTE` |
| coût estimé | Décimal | Loyer manqué × nombre de mois |
| commentaires | Texte |  |

### 17.2 Métrique
Taux de vacance annuel = (jours vacants / 365) × 100

---

## 18. Module — Notifications & calendrier

### 18.1 Champs

| Champ | Type |
|---|---|
| utilisateur destinataire | FK User |
| type | Enum (`FIN_BAIL`, `REVISION_IRL`, `RETARD_PAIEMENT`, `ECHEANCE_CREDIT`, `ASSURANCE_RENOUVELLEMENT`, `DIAGNOSTIC_EXPIRATION`, `EDL_PLANIFIE`, `GENERIQUE`) |
| sévérité | Enum (`INFO`, `WARNING`, `ERROR`) |
| titre | String |
| message | Texte |
| lien d'action | URL interne |
| données contextuelles | JSON |
| date de création | Timestamp |
| date de lecture | Timestamp |
| date d'expiration | Date |
| envoyé par email | Booléen |

### 18.2 Calendrier consolidé
Vue agrégée de toutes les échéances :
- Fins de bail (J-90, J-30)
- Révisions IRL programmées
- Diagnostics expirant
- Échéances de prêt
- Renouvellements d'assurance
- Loyers en retard

---

## 19. Module — Fiscalité (déclaration 2044)

### 19.1 Vue d'ensemble
Génération automatique des éléments à reporter sur la déclaration 2044 (régime réel) ou 2042-C-PRO (LMNP/LMP).

### 19.2 Données calculées

| Donnée | Calcul | Ligne 2044 |
|---|---|---|
| Loyers encaissés | Somme paiements de l'année | 211 |
| Recettes brutes | Loyers + récup charges | 215 |
| Frais de gestion et procédure | Charges catégorie correspondante | 221 |
| Primes d'assurance | Charges ASSURANCE_* | 223 |
| Dépenses récupérables non récupérées | Différence prov - réel | 224 |
| Travaux d'entretien et réparation | Charges TRAVAUX déductibles | 224 |
| Charges récupérables (déductibles si non payées par locataire) | Conditionnel | 226 |
| Provisions pour charges copro | Charges CHARGES_COPROPRIETE | 229 |
| Taxe foncière (hors TEOM) | Charge TAXE_FONCIERE | 227 |
| Intérêts d'emprunt | Échéances prêts (part intérêts) | 250 |
| Assurance emprunt | Échéances (part assurance) | 250 |
| Revenu net foncier | Recettes - charges déductibles | 263 |

### 19.3 Sortie
- PDF synthétique par bien et global
- Tableau Excel exportable
- Détail ligne par ligne avec lien vers les pièces justificatives

### 19.4 Multi-propriétaires (indivision / SCI)
Chaque part est répartie selon la quote-part du propriétaire.

---

## 20. Module — Calcul de rentabilité

### 20.1 Indicateurs

| Indicateur | Formule |
|---|---|
| Rentabilité brute | (Loyer annuel × 12) / Prix d'achat × 100 |
| Rentabilité nette | (Loyer annuel - charges - taxes) / Prix d'achat × 100 |
| Rentabilité nette-nette | Net après IR + prélèvements sociaux / Prix d'achat × 100 |
| Cash-flow mensuel | Loyer encaissé - mensualité prêt - charges courantes |
| Cash-flow annuel net | Cash-flow mensuel × 12 - taxes - travaux |
| TRI (Taux de Rendement Interne) | Calcul DCF sur la durée de détention |

### 20.2 Affichage
Par bien et global, mensuel et annuel, avec graphiques.

---

## 21. Module — Simulation de revente

### 21.1 Inputs
- Date de revente envisagée
- Prix de revente estimé
- Frais d'agence à la revente (%)
- Frais de mainlevée si crédit en cours

### 21.2 Calculs
- Capital restant dû à la date de revente (depuis échéancier)
- Frais de remboursement anticipé (3% capital ou 6 mois d'intérêts, plafonné)
- Plus-value brute
- Abattement pour durée de détention (IR : -6%/an de la 6e à la 21e année, exonération à 22 ans ; PS : -1.65%/an de la 6e à la 21e, -1.6% la 22e, -9% de la 23e à la 30e)
- Plus-value imposable
- IR plus-value (19%)
- Prélèvements sociaux (17.2%)
- Surtaxe sur plus-values élevées si applicable
- Net après revente

### 21.3 Sortie
- PDF "Scénario de sortie"
- Comparaison plusieurs scénarios (revente à différentes dates)

---

## 22. Module — Recherche, filtres, export

### 22.1 Recherche globale
Barre de recherche unique cherchant dans : biens, locataires, garants, propriétaires, contrats, références.

### 22.2 Filtres par module
- Biens : statut, ville, type, surface, loyer min/max
- Loyers : statut, période, bien, locataire
- Charges : catégorie, période, bien, déductibilité
- Diagnostics : type, expiration proche
- Documents : catégorie, type, date

### 22.3 Exports
- CSV / Excel : toute liste filtrée
- PDF : rapports synthétiques (bien, fiscalité, rentabilité, calendrier)

---

## 23. Module — Tableau de bord

### 23.1 Cartes principales
- Loyers encaissés ce mois / dus / impayés
- Trésorerie année en cours
- Taux d'occupation global
- Baux expirant dans les 6 mois
- Diagnostics expirant dans les 6 mois
- Prochaines révisions IRL

### 23.2 Graphiques
- Évolution mensuelle des recettes (12 derniers mois)
- Comparatif annuel sur 3 ans
- Répartition des charges par catégorie
- Cash-flow par bien

### 23.3 Actions rapides
- Générer les loyers du mois
- Encaisser un paiement
- Générer une quittance
- Ajouter une charge
- Envoyer un rappel

---

## 24. Sécurité, droits, audit

### 24.1 Authentification
- Email + mot de passe (hash bcrypt 12 rounds)
- JWT à courte durée + refresh token
- Optionnel : 2FA TOTP
- Verrouillage après 5 tentatives échouées

### 24.2 Autorisations (RBAC)

| Action | ADMIN | GESTIONNAIRE | LECTEUR |
|---|---|---|---|
| Lecture toutes données | ✅ | ✅ | ✅ |
| Création / modification | ✅ | ✅ | ❌ |
| Suppression | ✅ | ❌ | ❌ |
| Paramètres app | ✅ | ❌ | ❌ |
| Gestion utilisateurs | ✅ | ❌ | ❌ |

### 24.3 Audit trail
Pour chaque enregistrement sensible : qui, quand, quoi (création, modif, suppression), avant/après.

### 24.4 RGPD
- Export complet des données d'un locataire à la demande
- Suppression / anonymisation après le délai légal de conservation
- Consentement clair au stockage des pièces d'identité

---

## 25. Aspects techniques (recommandations)

### 25.1 Architecture
- Application web (frontend SPA + backend API REST)
- Base relationnelle (PostgreSQL recommandé)
- Stockage objet pour les fichiers (S3 ou MinIO)
- File de jobs pour les envois email et générations PDF

### 25.2 Hébergement
- Cloud (Render, Railway, OVH…) OU auto-hébergement (Docker Compose sur serveur perso/NAS)
- HTTPS obligatoire (Let's Encrypt, Caddy)
- Backups automatiques (BDD + fichiers) quotidiens, conservation 30 jours

### 25.3 Disponibilité
- Pas d'objectif HA (application personnelle)
- Maintenance possible la nuit
- Restauration backup testée trimestriellement

### 25.4 Performance
- < 500 biens, < 50 loyers/mois → aucune contrainte particulière
- Pagination par 20 sur les listes

### 25.5 Internationalisation
- Français uniquement (cible : France métropolitaine + DOM)
- Devise : EUR
- Format date : JJ/MM/AAAA
- Fuseau : Europe/Paris

---

## 26. Roadmap fonctionnelle (priorisation)

### 26.1 MVP (Phase 1 — indispensable)
- Auth + RBAC
- Propriétaires + biens
- Locataires + garants
- Contrats avec multi-locataires
- Loyers + paiements (avec ventilation)
- Quittances PDF + envoi email
- Documents (upload, visualisation, suppression)

### 26.2 Phase 2 — fortement souhaité
- Charges bailleur (toutes catégories)
- Prêts immobiliers + échéancier
- Rappels d'impayés
- Diagnostics + alertes expiration
- Tableau de bord

### 26.3 Phase 3 — optimisation et confort
- Indexation IRL automatique
- Calcul de rentabilité
- Suivi vacance locative
- États des lieux structurés
- Recherche globale + filtres avancés
- Notifications / calendrier consolidé

### 26.4 Phase 4 — fiscalité et avancé
- Déclaration 2044 (calcul + export PDF + Excel)
- Simulation de revente
- Multi-propriétaires (rapports individuels par quote-part)
- Audit trail complet
- 2FA

---

## 27. Annexes

### 27.1 Champs minimaux pour démarrer
Si on veut tester rapidement, les champs strictement minimaux par entité :

**Propriétaire** : nom, email, adresse complète, type
**Bien** : adresse complète, type, surface, loyer, charges, dépôt, statut
**Locataire** : civilité, nom, prénom, date de naissance, email, téléphone
**Garant** : civilité, nom, prénom, email, téléphone, type de garantie
**Contrat** : bien, locataires, dates, loyer, charges, dépôt, type, mode paiement, jour paiement
**Loyer** : auto-généré (mois, année, montant)
**Paiement** : montant, date, mode, payeur, ventilation(s)

### 27.2 Conformité légale (France, 2026)
- Loi du 6 juillet 1989 (baux d'habitation)
- Loi ALUR du 24 mars 2014
- Loi ELAN du 23 novembre 2018
- Décret n°87-712 (réparations locataire)
- Décret n°87-713 (charges récupérables)
- Décret n°2002-120 (logement décent)
- Loi Climat et Résilience du 22 août 2021 (DPE)

### 27.3 Modèles de documents légaux à fournir
- Notice d'information du locataire
- Modèle de bail (vide / meublé)
- Modèle de cautionnement
- Modèle d'état des lieux
- Modèle de quittance
- Modèle de courrier de mise en demeure
- Modèle de courrier de révision IRL
- Modèle de congé bailleur (vente, reprise)
