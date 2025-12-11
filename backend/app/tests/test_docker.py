"""Tests for Docker configuration files."""

import pytest
import yaml
import os

# Get the project root directory
# Use environment variable or calculate from this file's location
if "BIZPILOT_ROOT" in os.environ:
    PROJECT_ROOT = os.environ["BIZPILOT_ROOT"]
else:
    # This file is at: backend/app/tests/test_docker.py
    # Go up: tests -> app -> backend -> PROJECT_ROOT
    CURRENT_FILE = os.path.abspath(__file__)
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))

INFRA_DIR = os.path.join(PROJECT_ROOT, "infrastructure", "docker")


class TestDockerComposeConfig:
    """Tests for docker-compose.yml configuration."""

    @pytest.fixture
    def compose_config(self):
        """Load docker-compose.yml configuration."""
        compose_path = os.path.join(INFRA_DIR, "docker-compose.yml")
        with open(compose_path, "r") as f:
            return yaml.safe_load(f)

    def test_compose_file_is_valid_yaml(self, compose_config):
        """Test that docker-compose.yml is valid YAML."""
        assert compose_config is not None

    def test_compose_has_services(self, compose_config):
        """Test that docker-compose has services defined."""
        assert "services" in compose_config
        assert len(compose_config["services"]) > 0

    def test_compose_has_required_services(self, compose_config):
        """Test that all required services are defined."""
        required_services = ["db", "redis", "mailhog", "api", "web"]
        for service in required_services:
            assert service in compose_config["services"], f"Missing service: {service}"

    def test_db_service_uses_postgres_16(self, compose_config):
        """Test that db service uses PostgreSQL 16."""
        db_config = compose_config["services"]["db"]
        assert "postgres:16" in db_config["image"]

    def test_redis_service_uses_redis_7(self, compose_config):
        """Test that redis service uses Redis 7."""
        redis_config = compose_config["services"]["redis"]
        assert "redis:7" in redis_config["image"]

    def test_api_service_has_health_check(self, compose_config):
        """Test that API service has health check configured."""
        api_config = compose_config["services"]["api"]
        assert "healthcheck" in api_config

    def test_web_service_has_health_check(self, compose_config):
        """Test that web service has health check configured."""
        web_config = compose_config["services"]["web"]
        assert "healthcheck" in web_config

    def test_db_service_has_health_check(self, compose_config):
        """Test that db service has health check configured."""
        db_config = compose_config["services"]["db"]
        assert "healthcheck" in db_config

    def test_api_depends_on_db_and_redis(self, compose_config):
        """Test that API service depends on db and redis."""
        api_config = compose_config["services"]["api"]
        assert "depends_on" in api_config
        assert "db" in api_config["depends_on"]
        assert "redis" in api_config["depends_on"]

    def test_web_depends_on_api(self, compose_config):
        """Test that web service depends on API."""
        web_config = compose_config["services"]["web"]
        assert "depends_on" in web_config

    def test_volumes_are_defined(self, compose_config):
        """Test that volumes are defined for persistence."""
        assert "volumes" in compose_config
        assert "postgres_data" in compose_config["volumes"]
        assert "redis_data" in compose_config["volumes"]

    def test_api_has_volume_mount_for_hot_reload(self, compose_config):
        """Test that API service has volume mount for hot-reload."""
        api_config = compose_config["services"]["api"]
        assert "volumes" in api_config
        assert any("app" in v for v in api_config["volumes"])

    def test_web_has_volume_mount_for_hot_reload(self, compose_config):
        """Test that web service has volume mount for hot-reload."""
        web_config = compose_config["services"]["web"]
        assert "volumes" in web_config
        assert any("src" in v for v in web_config["volumes"])


class TestDockerfiles:
    """Tests for Dockerfile configurations."""

    def test_api_dockerfile_exists(self):
        """Test that API Dockerfile exists."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.api")
        assert os.path.exists(dockerfile_path)

    def test_web_dockerfile_exists(self):
        """Test that web Dockerfile exists."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.web")
        assert os.path.exists(dockerfile_path)

    def test_api_dockerfile_uses_python_312(self):
        """Test that API Dockerfile uses Python 3.12."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.api")
        with open(dockerfile_path, "r") as f:
            content = f.read()
        assert "python:3.12" in content

    def test_web_dockerfile_uses_node_20(self):
        """Test that web Dockerfile uses Node.js 20."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.web")
        with open(dockerfile_path, "r") as f:
            content = f.read()
        assert "node:20" in content

    def test_api_dockerfile_exposes_port_8000(self):
        """Test that API Dockerfile exposes port 8000."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.api")
        with open(dockerfile_path, "r") as f:
            content = f.read()
        assert "EXPOSE 8000" in content

    def test_web_dockerfile_exposes_port_3000(self):
        """Test that web Dockerfile exposes port 3000."""
        dockerfile_path = os.path.join(INFRA_DIR, "Dockerfile.web")
        with open(dockerfile_path, "r") as f:
            content = f.read()
        assert "EXPOSE 3000" in content


class TestDockerReadme:
    """Tests for Docker README documentation."""

    def test_readme_exists(self):
        """Test that README.md exists."""
        readme_path = os.path.join(INFRA_DIR, "README.md")
        assert os.path.exists(readme_path)

    def test_readme_has_quick_start(self):
        """Test that README has quick start section."""
        readme_path = os.path.join(INFRA_DIR, "README.md")
        with open(readme_path, "r") as f:
            content = f.read()
        assert "Quick Start" in content

    def test_readme_has_services_table(self):
        """Test that README has services documentation."""
        readme_path = os.path.join(INFRA_DIR, "README.md")
        with open(readme_path, "r") as f:
            content = f.read()
        assert "Services" in content
