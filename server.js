// Fichier : server.js (Version finale, corrigée et optimisée)

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
// On applique une politique CORS simple et globale. C'est la méthode la plus robuste.
app.use(cors());
// On s'assure que le serveur peut lire le JSON des requêtes.
app.use(express.json());
// On sert les fichiers statiques.
app.use(express.static(path.join(__dirname, 'public')));


// --- Connexion à la base de données PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// --- Initialisation de la BDD au démarrage ---
// Cette fonction crée la table AVEC les nouvelles colonnes si elle n'existe pas.
async function initializeDatabase() {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                job TEXT,
                organization TEXT,
                email TEXT NOT NULL,
                score INTEGER NOT NULL,
                responses JSONB,
                diag_title TEXT,
                diag_text TEXT,
                diag_recommendation TEXT,
                submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(createTableQuery);
        console.log("Connecté à PostgreSQL et la table 'submissions' est prête.");
    } catch (err) {
        console.error("Erreur lors de l'initialisation de la base de données:", err);
        process.exit(1);
    }
}

// --- Fonction de diagnostic (inchangée) ---
function getDiagnosticData(score) {
    if (score < 40) {
        return {
            title: "Opportunité à Préciser",
            text: "Votre besoin, en l'état, ne semble pas présenter les caractéristiques prioritaires pour un agent intelligent. Il pourrait être trop simple ou manquer de données.",
            recommendation: "Il est probable que des solutions d'automatisation standard (RPA, workflows simples) soient plus adaptées et rentables."
        };
    } else if (score >= 40 && score <= 70) {
        return {
            title: "Potentiel Confirmé",
            text: "Votre cas d'usage est un candidat sérieux ! Il possède plusieurs dimensions clés (complexité, récurrence, interactions) justifiant l'intervention d'un agent.",
            recommendation: "C'est le moment idéal pour approfondir l'analyse. Planifions un échange pour valider les aspects techniques et quantifier les gains."
        };
    } else {
        return {
            title: "Cas d'Usage Stratégique",
            text: "Votre projet est un candidat idéal et à forte valeur ajoutée. L'automatisation simple ne suffirait probablement pas.",
            recommendation: "Ce projet est probablement prioritaire. Nous vous recommandons vivement de lancer une étude de faisabilité pour concrétiser cette opportunité."
        };
    }
}

// --- Route principale de l'API ---

// Route de test de santé pour le diagnostic
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API is running' });
});

// Route pour soumettre le questionnaire (CORRIGÉE)
app.post('/submit-questionnaire', async (req, res) => {
    const { prospect, score, responses } = req.body;
    if (!prospect || !prospect.email || score === undefined || !responses) {
        return res.status(400).json({ success: false, message: "Données manquantes ou invalides." });
    }
    
    try {
        // 1. Obtenir les textes du diagnostic
        const diagnosticData = getDiagnosticData(score);

        // 2. Définir la requête d'insertion avec 9 colonnes
        const insertQuery = `
            INSERT INTO submissions(
                name, job, organization, email, score, responses, 
                diag_title, diag_text, diag_recommendation
            ) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        // 3. Préparer les 9 valeurs correspondantes dans le bon ordre
        const values = [
            prospect.name,              // $1
            prospect.job,               // $2
            prospect.organization,      // $3
            prospect.email,             // $4
            score,                      // $5
            JSON.stringify(responses),  // $6
            diagnosticData.title,       // $7
            diagnosticData.text,        // $8
            diagnosticData.recommendation // $9
        ];
        
        // 4. Exécuter la requête
        await pool.query(insertQuery, values);
        
        console.log(`Nouvelle soumission enregistrée pour ${prospect.email} (Score: ${score})`);
        
        // 5. Renvoyer une réponse de succès
        res.status(200).json({
            success: true,
            message: "Soumission enregistrée avec succès.",
            resultData: {
                score: score,
                ...diagnosticData
            }
        });

    } catch (error) {
        console.error("Erreur lors de l'enregistrement SQL:", error);
        res.status(500).json({ success: false, message: "Erreur interne du serveur lors de l'enregistrement." });
    }
});


// --- Démarrage du serveur ---
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Serveur démarré et à l'écoute sur le port ${PORT}`);
    });
});