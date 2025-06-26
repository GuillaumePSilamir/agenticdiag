// Fichier : server.js (Version corrigée et nettoyée)

// Importation des modules nécessaires
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors'); // Déclaration UNIQUE de cors

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration explicite de CORS pour la production ---
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://agenticdiag.vercel.app' // URL de votre site Vercel
];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

// --- Middlewares --- (Section unique et dans le bon ordre)
app.use(cors(corsOptions)); // 1. Appliquer les règles CORS
app.use(express.json());   // 2. Parser le JSON
app.use(express.static(path.join(__dirname, 'public'))); // 3. Servir les fichiers statiques

// --- Connexion à la base de données PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ... (le reste de votre fichier : initializeDatabase, getDiagnosticData, app.post, etc. est correct) ...
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
app.post('/submit-questionnaire', async (req, res) => {
    const { prospect, score, responses } = req.body;
    if (!prospect || !prospect.email || score === undefined || !responses) {
        return res.status(400).json({ success: false, message: "Données manquantes ou invalides." });
    }
    try {
        const insertQuery = `
            INSERT INTO submissions (name, job, organization, email, score, responses) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [
            prospect.name,
            prospect.job,
            prospect.organization,
            prospect.email,
            score,
            JSON.stringify(responses)
        ];
        await pool.query(insertQuery, values);
        console.log(`Nouvelle soumission enregistrée pour ${prospect.email} (Score: ${score})`);
        const diagnosticData = getDiagnosticData(score);
        res.status(200).json({
            success: true,
            message: "Soumission enregistrée avec succès.",
            resultData: {
                score: score,
                ...diagnosticData
            }
        });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de la soumission:", error);
        res.status(500).json({ success: false, message: "Une erreur est survenue sur le serveur." });
    }
});
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Serveur démarré et à l'écoute sur le port ${PORT}`);
    });
});