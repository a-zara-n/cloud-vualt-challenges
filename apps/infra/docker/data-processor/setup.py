"""Initial setup script - reads secret.txt for configuration"""
import sys

def main():
    if '--init' in sys.argv:
        print("Initializing data processor configuration...")
        try:
            with open('secret.txt', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        print(f"  Loaded config: {line.split('=')[0] if '=' in line else 'flag'}")
        except FileNotFoundError:
            print("  No secret.txt found, skipping initialization")
        print("Initialization complete.")

if __name__ == '__main__':
    main()
