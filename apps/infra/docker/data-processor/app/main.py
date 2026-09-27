"""TechVault Data Processor - Main application"""
import os
import json

def main():
    print("TechVault Data Processor v2.1")
    print(f"Region: {os.environ.get('AWS_DEFAULT_REGION', 'ap-northeast-1')}")
    print("Waiting for events...")

if __name__ == '__main__':
    main()
