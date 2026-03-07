pipeline {
    agent any

    tools {
        nodejs "nodejs
    }

    stages {

        stage('Clone Repository') {
            steps {
                git branch: 'main', url: 'https://github.com/nirvaan8/insurance-fraud.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Run Application Check') {
            steps {
                bat 'npm start'
            }
        }

    }
}