"""Retired PyQt6 interface, kept for reference. The current app is frontend/ (run.py).

Run from the project root:  python legacy/pyqt/main.py
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from PyQt6.QtWidgets import QApplication
from legacy.pyqt.ui.main_window import MainWindow

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("IskoMatic")
    app.setStyle("Fusion")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
