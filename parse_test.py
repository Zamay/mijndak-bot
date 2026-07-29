import sys
from bs4 import BeautifulSoup

def main():
    with open('bot/woningaanbod_dump.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    links = soup.find_all('a', href=lambda href: href and 'PublicatieId=' in href)
    for i, link in enumerate(links[:5]):
        print(f"--- Link {i} ---")
        print(link.get_text(separator=' | ', strip=True))

if __name__ == '__main__':
    main()
