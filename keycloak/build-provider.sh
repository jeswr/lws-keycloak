# LWS Keycloak Provider Build Script

echo "Building LWS Keycloak Provider..."

# Navigate to provider directory
cd keycloak/lws-provider

# Build with Maven
mvn clean package

# Check build status
if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "JAR file: target/lws-provider-1.0.0.jar"
    
    # Copy to Keycloak providers directory
    cp target/lws-provider-1.0.0.jar ../providers/
    echo "Copied to Keycloak providers directory"
else
    echo "Build failed!"
    exit 1
fi
