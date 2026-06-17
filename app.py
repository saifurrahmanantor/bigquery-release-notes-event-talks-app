from flask import Flask, jsonify, render_template, request
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
import re
import time
import os

app = Flask(__name__)

# In-memory cache to prevent hitting Google's servers too frequently
FEED_CACHE = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SECS = 600  # 10 minutes cache
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NAMESPACE = {'atom': 'http://www.w3.org/2005/Atom'}

class ReleaseContentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.updates = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        
    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self._save_current()
            self.current_type = ''
        else:
            attr_str = "".join([f' {k}="{v}"' for k, v in attrs])
            self.current_html.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.current_type = "".join(self.current_text).strip()
            self.current_text = []
        else:
            self.current_html.append(f"</{tag}>")

    def handle_data(self, data):
        if self.current_type is None:
            # Data before any h3 (rare in GCP feed, but possible)
            return
        if self.current_type == '':
            self.current_text.append(data)
        else:
            self.current_html.append(data)
            self.current_text.append(data)

    def _save_current(self):
        if self.current_type is not None:
            html_content = "".join(self.current_html).strip()
            text_content = "".join(self.current_text).strip()
            # Clean up double spaces, newlines, etc.
            text_content = re.sub(r'\s+', ' ', text_content)
            
            if self.current_type or html_content:
                self.updates.append({
                    'type': self.current_type or 'General',
                    'html': html_content,
                    'text': text_content
                })
            self.current_html = []
            self.current_text = []

    def parse(self, html_content):
        self.feed(html_content)
        self._save_current()
        return self.updates


def fetch_and_parse_feed(force_refresh=False):
    global FEED_CACHE
    now = time.time()
    
    if not force_refresh and FEED_CACHE["data"] is not None and (now - FEED_CACHE["last_fetched"]) < CACHE_DURATION_SECS:
        print("Returning cached release notes.")
        return FEED_CACHE["data"]
        
    print("Fetching fresh release notes from Google Cloud feed...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        entries = root.findall('atom:entry', ATOM_NAMESPACE)
        
        parsed_updates = []
        item_id_counter = 0
        
        for entry in entries:
            title = entry.find('atom:title', ATOM_NAMESPACE).text  # e.g., "June 15, 2026"
            updated = entry.find('atom:updated', ATOM_NAMESPACE).text  # e.g., "2026-06-15T00:00:00-07:00"
            
            link_elem = entry.find('atom:link', ATOM_NAMESPACE)
            link = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', ATOM_NAMESPACE)
            content_html = content_elem.text if content_elem is not None else ''
            
            if not content_html:
                continue
                
            # Parse updates inside this entry
            parser = ReleaseContentParser()
            updates = parser.parse(content_html)
            
            for index, upd in enumerate(updates):
                item_id_counter += 1
                parsed_updates.append({
                    'id': f"upd-{item_id_counter}",
                    'date': title,
                    'isoDate': updated,
                    'type': upd['type'],
                    'html': upd['html'],
                    'text': upd['text'],
                    'link': link
                })
                
        FEED_CACHE["data"] = parsed_updates
        FEED_CACHE["last_fetched"] = now
        return parsed_updates
        
    except Exception as e:
        print(f"Error fetching/parsing feed: {e}")
        # If fetch fails but we have cached data, return cached data as fallback
        if FEED_CACHE["data"] is not None:
            print("Fetch failed. Returning stale cache.")
            return FEED_CACHE["data"]
        raise e


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            'success': True,
            'releases': releases,
            'cached': not force_refresh and (time.time() - FEED_CACHE["last_fetched"]) > 1,
            'last_fetched': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(FEED_CACHE["last_fetched"]))
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    # Make sure template and static directories exist
    os.makedirs(os.path.join(os.path.dirname(__file__), 'templates'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'static', 'css'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'static', 'js'), exist_ok=True)
    
    app.run(host='127.0.0.1', port=5000, debug=True)
