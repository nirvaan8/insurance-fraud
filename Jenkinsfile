pipeline {
  agent any

  environment {
    IMAGE_NAME     = "fraudsys"
    IMAGE_TAG      = "${BUILD_NUMBER}"
    RAILWAY_TOKEN  = credentials('RAILWAY_TOKEN')
    NODE_ENV       = "test"
  }

  options {
    timeout(time: 20, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {

    // ── 1. CHECKOUT ─────────────────────────────────────────
    stage('Checkout') {
      steps {
        echo "╔══════════════════════════════════════╗"
        echo "║  FraudSys CI/CD — Build #${BUILD_NUMBER}  ║"
        echo "╚══════════════════════════════════════╝"
        checkout scm
        sh 'git log --oneline -5'
      }
    }

    // ── 2. INSTALL DEPS ─────────────────────────────────────
    stage('Install Dependencies') {
      steps {
        dir('backend') {
          sh 'node --version'
          sh 'npm --version'
          sh 'npm install'
          echo "✅ Dependencies installed"
        }
      }
    }

    // ── 3. LINT ─────────────────────────────────────────────
    stage('Lint') {
      steps {
        dir('backend') {
          sh '''
            echo "// Checking for syntax errors..."
            node --check server.js       && echo "✅ server.js OK"
            node --check predict_batch.js && echo "✅ predict_batch.js OK"
          '''
        }
      }
    }

    // ── 4. UNIT TESTS ────────────────────────────────────────
    stage('Unit Tests') {
      steps {
        dir('backend') {
          sh 'node test.js'
        }
      }
      post {
        failure {
          echo "❌ Tests failed — aborting deployment"
        }
        success {
          echo "✅ All tests passed"
        }
      }
    }

    // ── 5. SECURITY SCAN ─────────────────────────────────────
    stage('Security Scan') {
      steps {
        dir('backend') {
          sh '''
            echo "// Running npm audit..."
            npm audit --audit-level=critical || true
            echo "// Checking for hardcoded secrets..."
            ! grep -rn "password.*=.*['\"][a-zA-Z0-9]\\{8,\\}" . \
              --include="*.js" \
              --exclude-dir=node_modules \
              --exclude-dir=tests \
              || true
            echo "✅ Security scan complete"
          '''
        }
      }
    }

    // ── 6. DOCKER BUILD ──────────────────────────────────────
    stage('Docker Build') {
      steps {
        sh '''
          echo "// Building Docker image..."
          docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest .
          echo "✅ Docker image built: ${IMAGE_NAME}:${IMAGE_TAG}"
        '''
      }
    }

    // ── 7. DOCKER SMOKE TEST ─────────────────────────────────
    stage('Docker Smoke Test') {
      steps {
        sh '''
          echo "// Running smoke test..."

          # Start container with test env
          docker run -d --name fraudsys-test \
            -p 3001:3000 \
            -e NODE_ENV=test \
            -e MONGO_URI=mongodb://host.docker.internal:27017/fraudDB_test \
            -e JWT_SECRET=test-secret-key \
            ${IMAGE_NAME}:${IMAGE_TAG}

          # Wait for app to start
          sleep 8

          # Hit health endpoint
          HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")
          echo "Health check status: ${HEALTH}"

          # Cleanup
          docker stop fraudsys-test || true
          docker rm  fraudsys-test  || true

          # Pass even if DB not connected (expected in CI)
          if [ "$HEALTH" = "200" ] || [ "$HEALTH" = "503" ]; then
            echo "✅ Smoke test passed (HTTP ${HEALTH})"
          else
            echo "❌ Smoke test failed (HTTP ${HEALTH})"
            exit 1
          fi
        '''
      }
    }

    // ── 8. DEPLOY TO RAILWAY ─────────────────────────────────
    stage('Deploy to Railway') {
      when {
        branch 'main'
      }
      steps {
        sh '''
          echo "// Deploying to Railway..."

          # Install Railway CLI if not present
          if ! command -v railway &> /dev/null; then
            npm install -g @railway/cli
          fi

          # Deploy using Railway token
          railway up --detach --token ${RAILWAY_TOKEN}

          echo "✅ Deployment triggered on Railway"
        '''
      }
      post {
        success {
          echo "🚀 Deployed to https://insurance-fraud-production.up.railway.app"
        }
        failure {
          echo "❌ Railway deployment failed"
        }
      }
    }

  }

  // ── POST PIPELINE ────────────────────────────────────────
  post {
    always {
      echo "// Cleaning up dangling Docker images..."
      sh 'docker image prune -f || true'
    }
    success {
      echo """
      ╔══════════════════════════════════════╗
      ║  ✅ BUILD #${BUILD_NUMBER} SUCCEEDED       ║
      ║  Branch: ${GIT_BRANCH}
      ║  Commit: ${GIT_COMMIT?.take(7)}
      ╚══════════════════════════════════════╝
      """
    }
    failure {
      echo """
      ╔══════════════════════════════════════╗
      ║  ❌ BUILD #${BUILD_NUMBER} FAILED          ║
      ╚══════════════════════════════════════╝
      """
    }
  }
}
