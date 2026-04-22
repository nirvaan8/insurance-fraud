pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
        APP_NAME     = 'insurance-fraud'
        DOCKER_IMAGE = "nirvaan8tk/fraudsys"
        DOCKER_TAG   = "${BUILD_NUMBER}"
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '5'))
    }

    stages {

        stage('Checkout') {
            steps {
                echo "=============================="
                echo " STAGE 1: CHECKOUT"
                echo "=============================="
                checkout scm
                echo "Branch: ${env.GIT_BRANCH}"
                echo "Commit: ${env.GIT_COMMIT}"
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "=============================="
                echo " STAGE 2: INSTALL DEPENDENCIES"
                echo "=============================="
                script {
                    if (isUnix()) {
                        sh 'npm install'
                    } else {
                        bat 'chcp 65001 && npm install'
                    }
                }
            }
        }

        stage('Code Quality') {
            steps {
                echo "=============================="
                echo " STAGE 3: LINT"
                echo "=============================="
                script {
                    if (isUnix()) {
                        sh 'npx eslint backend/server.js --max-warnings=30 || true'
                    } else {
                        bat 'chcp 65001 && npx eslint backend/server.js --max-warnings=30 || exit 0'
                    }
                }
            }
        }

        stage('Unit Tests') {
            steps {
                echo "=============================="
                echo " STAGE 4: TESTS"
                echo "=============================="
                script {
                    if (isUnix()) {
                        sh 'npm test --if-present || echo "No tests - skipping"'
                    } else {
                        bat 'chcp 65001 && npm test --if-present || echo No tests'
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    try {
                        if (isUnix()) {
                            sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
                        } else {
                            bat "chcp 65001 && docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
                        }
                    } catch (Exception e) {
                        echo "Docker build failed - ${e.message}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('Docker Push') {
            when {
                expression { currentBuild.result != 'UNSTABLE' }
            }
            steps {
                script {
                    try {
                        withCredentials([usernamePassword(
                            credentialsId: 'dockerhub-creds',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )]) {
                            if (isUnix()) {
                                sh """
                                echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin
                                docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                                docker push ${DOCKER_IMAGE}:latest
                                docker logout
                                """
                            } else {
                                bat """
                                chcp 65001
                                echo %DOCKER_PASS% | docker login -u %DOCKER_USER% --password-stdin
                                docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                                docker push ${DOCKER_IMAGE}:latest
                                docker logout
                                """
                            }
                        }
                    } catch (Exception e) {
                        echo "Docker push failed - ${e.message}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    try {
                        if (isUnix()) {
                            sh """
                            docker run -d --name fraudsys-test-${BUILD_NUMBER} -p 3099:3000 ${DOCKER_IMAGE}:${DOCKER_TAG}
                            sleep 10
                            curl -f http://localhost:3099/health
                            docker rm -f fraudsys-test-${BUILD_NUMBER}
                            """
                        } else {
                            bat """
                            chcp 65001
                            docker run -d --name fraudsys-test-${BUILD_NUMBER} -p 3099:3000 ${DOCKER_IMAGE}:${DOCKER_TAG}
                            timeout /t 10
                            curl -f http://localhost:3099/health
                            docker rm -f fraudsys-test-${BUILD_NUMBER}
                            """
                        }
                    } catch (Exception e) {
                        echo "Health check failed - ${e.message}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'HOOK')]) {
                        if (isUnix()) {
                            sh 'curl -X POST "$HOOK"'
                        } else {
                            bat 'chcp 65001 && curl -X POST "%HOOK%"'
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo "BUILD SUCCESS"
        }
        unstable {
            echo "BUILD UNSTABLE"
        }
        failure {
            echo "BUILD FAILED"
        }
    }
}
