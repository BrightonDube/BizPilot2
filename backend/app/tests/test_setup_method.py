import pytest

class TestSetup:
    def setup_method(self):
        print("SETUP METHOD RUN")
        self.x = 1

    def test_x(self):
        assert self.x == 1

