"""Tests for CI/CD configuration files."""

import pytest
import yaml
import os

# Get the project root directory
CURRENT_FILE = os.path.abspath(__file__)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))
GITHUB_DIR = os.path.join(PROJECT_ROOT, ".github")
WORKFLOWS_DIR = os.path.join(GITHUB_DIR, "workflows")


class TestCIWorkflow:
    """Tests for CI workflow configuration."""

    @pytest.fixture
    def ci_config(self):
        """Load CI workflow configuration."""
        ci_path = os.path.join(WORKFLOWS_DIR, "ci.yml")
        with open(ci_path, "r") as f:
            return yaml.safe_load(f)

    def test_ci_workflow_exists(self):
        """Test that CI workflow file exists."""
        ci_path = os.path.join(WORKFLOWS_DIR, "ci.yml")
        assert os.path.exists(ci_path)

    def test_ci_triggers_on_push_to_main(self, ci_config):
        """Test that CI triggers on push to main."""
        # 'on' is parsed as True in YAML
        assert True in ci_config
        assert "push" in ci_config[True]
        assert "main" in ci_config[True]["push"]["branches"]

    def test_ci_triggers_on_pull_request(self, ci_config):
        """Test that CI triggers on pull requests."""
        assert True in ci_config
        assert "pull_request" in ci_config[True]

    def test_ci_has_backend_job(self, ci_config):
        """Test that CI has backend job."""
        assert "backend" in ci_config["jobs"]

    def test_ci_has_frontend_job(self, ci_config):
        """Test that CI has frontend job."""
        assert "frontend" in ci_config["jobs"]

    def test_backend_job_runs_tests(self, ci_config):
        """Test that backend job runs tests."""
        backend_steps = ci_config["jobs"]["backend"]["steps"]
        step_names = [step.get("name", "") for step in backend_steps]
        assert any("test" in name.lower() for name in step_names)

    def test_frontend_job_runs_build(self, ci_config):
        """Test that frontend job runs build."""
        frontend_steps = ci_config["jobs"]["frontend"]["steps"]
        step_names = [step.get("name", "") for step in frontend_steps]
        assert any("build" in name.lower() for name in step_names)

    def test_frontend_job_runs_lint(self, ci_config):
        """Test that frontend job runs lint."""
        frontend_steps = ci_config["jobs"]["frontend"]["steps"]
        step_names = [step.get("name", "") for step in frontend_steps]
        assert any("lint" in name.lower() for name in step_names)


class TestDeployWorkflow:
    """Tests for deploy workflow configuration."""

    def test_deploy_workflow_exists(self):
        """Test that deploy workflow file exists."""
        deploy_path = os.path.join(WORKFLOWS_DIR, "deploy.yml")
        assert os.path.exists(deploy_path)

    @pytest.fixture
    def deploy_config(self):
        """Load deploy workflow configuration."""
        deploy_path = os.path.join(WORKFLOWS_DIR, "deploy.yml")
        with open(deploy_path, "r") as f:
            return yaml.safe_load(f)

    def test_deploy_triggers_on_main_push(self, deploy_config):
        """Test that deploy triggers on push to main."""
        # 'on' is parsed as True in YAML
        assert True in deploy_config
        assert "push" in deploy_config[True]
        assert "main" in deploy_config[True]["push"]["branches"]

    def test_deploy_has_workflow_dispatch(self, deploy_config):
        """Test that deploy can be triggered manually."""
        assert True in deploy_config
        assert "workflow_dispatch" in deploy_config[True]


class TestDependabot:
    """Tests for Dependabot configuration."""

    def test_dependabot_config_exists(self):
        """Test that dependabot.yml exists."""
        dependabot_path = os.path.join(GITHUB_DIR, "dependabot.yml")
        assert os.path.exists(dependabot_path)

    @pytest.fixture
    def dependabot_config(self):
        """Load Dependabot configuration."""
        dependabot_path = os.path.join(GITHUB_DIR, "dependabot.yml")
        with open(dependabot_path, "r") as f:
            return yaml.safe_load(f)

    def test_dependabot_has_pip_updates(self, dependabot_config):
        """Test that Dependabot monitors pip dependencies."""
        ecosystems = [u["package-ecosystem"] for u in dependabot_config["updates"]]
        assert "pip" in ecosystems

    def test_dependabot_has_npm_updates(self, dependabot_config):
        """Test that Dependabot monitors npm dependencies."""
        ecosystems = [u["package-ecosystem"] for u in dependabot_config["updates"]]
        assert "npm" in ecosystems

    def test_dependabot_has_github_actions_updates(self, dependabot_config):
        """Test that Dependabot monitors GitHub Actions."""
        ecosystems = [u["package-ecosystem"] for u in dependabot_config["updates"]]
        assert "github-actions" in ecosystems


class TestPRTemplate:
    """Tests for PR template."""

    def test_pr_template_exists(self):
        """Test that PR template exists."""
        template_path = os.path.join(GITHUB_DIR, "pull_request_template.md")
        assert os.path.exists(template_path)

    def test_pr_template_has_description_section(self):
        """Test that PR template has description section."""
        template_path = os.path.join(GITHUB_DIR, "pull_request_template.md")
        with open(template_path, "r") as f:
            content = f.read()
        assert "Description" in content

    def test_pr_template_has_checklist(self):
        """Test that PR template has checklist."""
        template_path = os.path.join(GITHUB_DIR, "pull_request_template.md")
        with open(template_path, "r") as f:
            content = f.read()
        assert "Checklist" in content


class TestIssueTemplates:
    """Tests for issue templates."""

    def test_bug_report_template_exists(self):
        """Test that bug report template exists."""
        template_path = os.path.join(GITHUB_DIR, "ISSUE_TEMPLATE", "bug_report.md")
        assert os.path.exists(template_path)

    def test_feature_request_template_exists(self):
        """Test that feature request template exists."""
        template_path = os.path.join(GITHUB_DIR, "ISSUE_TEMPLATE", "feature_request.md")
        assert os.path.exists(template_path)
