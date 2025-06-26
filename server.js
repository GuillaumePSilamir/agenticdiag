// Fichier : server.js (Prêt pour le déploiement sur Railway avec PostgreSQL)

// Importation des modules nécessaires
require('dotenv').config(); // Permet de lire les variables d'environnement depuis un fichier .env (utile pour le dev local)
const express = require('express');
const { Pool } = require('pg'); // Client pour se connecter à PostgreSQL
const path = require('path');
const cors = require('cors');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000; // Le port est fourni par Railway ou par défaut 3000 en local

// --- Middlewares ---
const cors = require('cors');

// --- Configuration explicite de CORS pour la production ---
const allowedOrigins = [
    'http://localhost:3000', // Pour le développement local (si vous avez un frontend sur le port 3000)
    'http://localhost:5173', // Port par défaut pour Vite/React en dev local (au cas où)
    'https://agenticdiag.vercel.app' // VOTRE URL VERCEL DE PRODUCTION
];

const corsOptions = {
    origin: function (origin, callback) {
        // Autoriser les requêtes sans origine (ex: Postman, apps mobiles) et celles de notre liste
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

// --- Middlewares ---
app.use(cors(corsOptions)); // Utilisez les options de configuration ici
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Sert les fichiers statiques (votre index.html)

// --- Connexion à la base de données PostgreSQL ---
// Le client 'pg' va automatiquement utiliser la variable d'environnement DATABASE_URL
// fournie par Railway.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Requis pour les connexions SSL sur des services comme Railway ou Heroku
    }
});

// Fonction pour initialiser la table dans la BDD au démarrage du serveur
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
        // Si la BDD n'est pas accessible, on arrête le processus pour éviter des erreurs en cascade.
        process.exit(1);
    }
}

// --- Fonction de diagnostic --- (inchangée)
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

// --- API Endpoint pour recevoir et sauvegarder les soumissions ---
app.post('/submit-questionnaire', async (req, res) => {
    const { prospect, score, responses } = req.body;

    // Validation des données entrantes
    if (!prospect || !prospect.email || score === undefined || !responses) {
        return res.status(400).json({ success: false, message: "Données manquantes ou invalides." });
    }

    try {
        // 1. Sauvegarder les données dans PostgreSQL
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
            JSON.stringify(responses) // Le type JSONB de PostgreSQL est plus efficace pour stocker du JSON
        ];
        
        await pool.query(insertQuery, values);
        console.log(`Nouvelle soumission enregistrée pour ${prospect.email} (Score: ${score})`);

        // 2. Générer le diagnostic pour la réponse immédiate
        const diagnosticData = getDiagnosticData(score);

        // 3. Répondre au client avec un succès et les données du diagnostic
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

// --- Démarrage du serveur ---
// On initialise la BDD avant de commencer à écouter les requêtes.
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Serveur démarré et à l'écoute sur le port ${PORT}`);
    });
});