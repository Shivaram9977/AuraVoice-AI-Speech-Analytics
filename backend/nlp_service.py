import re
from collections import Counter

# Try importing NLTK, but provide solid fallbacks if NLTK or its resources aren't fully installed/downloaded.
try:
    import nltk
    from nltk.sentiment.vader import SentimentIntensityAnalyzer
    from nltk.tokenize import sent_tokenize, word_tokenize
    from nltk.corpus import stopwords
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

# Fallback lists
STOPWORDS_FALLBACK = set([
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
    "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an",
    "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up",
    "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
])

POSITIVE_WORDS = set([
    "good", "great", "excellent", "awesome", "wonderful", "amazing", "love", "like", "happy", "best", "perfect",
    "fantastic", "brilliant", "beautiful", "glad", "proud", "agree", "correct", "yes", "outstanding", "superb",
    "helpful", "smart", "intelligent", "easy", "simple", "efficient", "reliable", "secure", "strong", "success",
    "successful", "achieve", "improve", "improvement", "recommend", "satisfy", "satisfied", "enjoy", "pleasant"
])

NEGATIVE_WORDS = set([
    "bad", "terrible", "worst", "awful", "horrible", "hate", "dislike", "sad", "angry", "wrong", "error", "fail",
    "failure", "bug", "broken", "useless", "difficult", "hard", "slow", "expensive", "hate", "scared", "fear",
    "problem", "issue", "poor", "pain", "hurt", "damage", "destroy", "annoy", "annoyed", "frustrated", "frustrating",
    "waste", "wasted", "deny", "disagree", "reject", "refuse", "negative", "disappointed", "disappointment"
])

FILLER_WORDS = [
    "um", "uh", "ah", "like", "you know", "so", "actually", "basically", "seriously", "literally", "right", "okay", "i mean"
]

class NLPService:
    def __init__(self):
        self.sia = None
        self.stopwords = STOPWORDS_FALLBACK
        
        if NLTK_AVAILABLE:
            try:
                # Ensure resources are downloaded (handled in setup, but double check here)
                nltk.data.find('tokenizers/punkt')
                nltk.data.find('sentiment/vader_lexicon')
                nltk.data.find('corpora/stopwords')
                
                self.sia = SentimentIntensityAnalyzer()
                self.stopwords = set(stopwords.words('english'))
            except Exception as e:
                print(f"[NLPService] NLTK resources not found. Falling back to heuristic methods. Details: {e}")
                self.sia = None

    def analyze_sentiment(self, text: str):
        """Analyzes sentiment of the text and returns a score and classification."""
        if not text.strip():
            return {"score": 50, "label": "Neutral", "positive_pct": 0, "negative_pct": 0, "neutral_pct": 100}
            
        if self.sia:
            try:
                scores = self.sia.polarity_scores(text)
                # Compound score ranges from -1 to 1. Map it to 0-100.
                compound = scores['compound']
                score = int((compound + 1) * 50)
                
                # Percentages
                pos = int(scores['pos'] * 100)
                neg = int(scores['neg'] * 100)
                neu = 100 - (pos + neg)
                
                if compound >= 0.05:
                    label = "Positive"
                elif compound <= -0.05:
                    label = "Negative"
                else:
                    label = "Neutral"
                    
                return {
                    "score": score,
                    "label": label,
                    "positive_pct": pos,
                    "negative_pct": neg,
                    "neutral_pct": neu
                }
            except Exception:
                pass # Fall back to heuristic
                
        # Heuristic fallback
        words = re.findall(r'\b\w+\b', text.lower())
        if not words:
            return {"score": 50, "label": "Neutral", "positive_pct": 0, "negative_pct": 0, "neutral_pct": 100}
            
        pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
        neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
        total_sentiment_words = pos_count + neg_count
        
        if total_sentiment_words == 0:
            return {"score": 50, "label": "Neutral", "positive_pct": 10, "negative_pct": 10, "neutral_pct": 80}
            
        score = int((pos_count / total_sentiment_words) * 100)
        pos_pct = int((pos_count / len(words)) * 100)
        neg_pct = int((neg_count / len(words)) * 100)
        neu_pct = 100 - (pos_pct + neg_pct)
        
        if pos_count > neg_count:
            label = "Positive"
        elif neg_count > pos_count:
            label = "Negative"
        else:
            label = "Neutral"
            
        return {
            "score": score,
            "label": label,
            "positive_pct": max(pos_pct, 5) if label == "Positive" else pos_pct,
            "negative_pct": max(neg_pct, 5) if label == "Negative" else neg_pct,
            "neutral_pct": neu_pct
        }

    def detect_filler_words(self, text: str):
        """Detects filler words, highlights them, and computes a fluency score."""
        if not text.strip():
            return {"score": 100, "count": 0, "details": {}, "highlighted_text": ""}
            
        text_lower = text.lower()
        words = re.findall(r'\b\w+\b', text)
        total_words = len(words)
        
        if total_words == 0:
            return {"score": 100, "count": 0, "details": {}, "highlighted_text": ""}
            
        # Count filler words
        filler_counts = {}
        total_fillers = 0
        
        # We replace using regex to count and highlight
        highlighted_text = text
        for filler in FILLER_WORDS:
            # Word boundary regex for single words or phrases
            pattern = re.compile(rf'\b({re.escape(filler)})\b', re.IGNORECASE)
            matches = pattern.findall(text)
            if matches:
                count = len(matches)
                filler_counts[filler] = count
                total_fillers += count
                # Highlight in html format
                highlighted_text = pattern.sub(r'<span class="filler-word" title="Filler word: \1">\1</span>', highlighted_text)
                
        # Fluency Score: Penalty based on filler density.
        # Standard: > 5% filler words begins to hurt fluency.
        density = (total_fillers / total_words) * 100
        # 100% score for 0 fillers, decreases linearly. Max penalty is 100 (score 0).
        # Let's say 1 filler word per 10 words (10% density) reduces score to 50.
        score = max(0, int(100 - (density * 5)))
        
        return {
            "score": score,
            "count": total_fillers,
            "details": filler_counts,
            "highlighted_text": highlighted_text
        }

    def extract_keyphrases(self, text: str, top_n: int = 5):
        """Extracts key topics/words from the text based on term frequency."""
        if not text.strip():
            return []
            
        # Clean and tokenize
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        filtered_words = [w for w in words if w not in self.stopwords]
        
        # Word frequency
        counter = Counter(filtered_words)
        common_words = counter.most_common(top_n)
        
        return [{"keyword": word, "count": count} for word, count in common_words]

    def extract_entities(self, text: str):
        """Extracts basic named entities like Names, Dates, Organizations, Locations."""
        entities = {"PERSON": [], "ORG": [], "GPE": [], "DATE_TIME": []}
        if not text.strip():
            return entities
            
        # Heuristic rules for Entity Extraction
        # 1. Names/Organizations (Capitalized words that aren't at the start of sentences)
        # We split text into sentences first to ignore sentence-starting capitalization.
        if NLTK_AVAILABLE:
            try:
                sentences = sent_tokenize(text)
            except Exception:
                sentences = re.split(r'[.!?]\s+', text)
        else:
            sentences = re.split(r'[.!?]\s+', text)
            
        potential_names = []
        potential_orgs = []
        
        for sent in sentences:
            if not sent.strip():
                continue
            words = sent.split()
            for idx, word in enumerate(words):
                # Clean punctuation
                cleaned = re.sub(r'[^\w\s]', '', word)
                if idx > 0 and cleaned and cleaned[0].isupper() and len(cleaned) > 2:
                    # Ignore common stopwords capitalized
                    if cleaned.lower() not in self.stopwords:
                        potential_names.append(cleaned)
                        
        # 2. Date and Time entities
        date_pattern = r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|January|February|March|April|May|June|July|August|September|October|November|December|today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b'
        dates = re.findall(date_pattern, text, re.IGNORECASE)
        entities["DATE_TIME"] = list(set(dates))
        
        # 3. Numeric/Amounts
        money_pattern = r'\b(\$\d+[\d,]*\.?\d*|\d+\s*(dollars|euros|pounds|percent|%))\b'
        money = [m[0] for m in re.findall(money_pattern, text, re.IGNORECASE)]
        
        # Collate entities
        name_counts = Counter(potential_names)
        # Simple split logic: if it ends with common corporation suffixes, it's an ORG, else PERSON
        org_suffixes = ["corp", "inc", "ltd", "co", "google", "microsoft", "amazon", "apple", "facebook", "meta", "openai", "university"]
        
        for name, count in name_counts.items():
            is_org = any(suffix in name.lower() for suffix in org_suffixes)
            if is_org:
                entities["ORG"].append(name)
            else:
                entities["PERSON"].append(name)
                
        # GPE (Locations) heuristics (Common countries/cities list check)
        locations_list = ["london", "new york", "paris", "tokyo", "india", "usa", "germany", "california", "delhi", "mumbai", "san francisco", "america"]
        words_all = re.findall(r'\b\w+\b', text.lower())
        for w in words_all:
            if w in locations_list:
                entities["GPE"].append(w.capitalize())
                
        # Deduplicate
        entities["PERSON"] = list(set(entities["PERSON"]))[:5]
        entities["ORG"] = list(set(entities["ORG"]))[:5]
        entities["GPE"] = list(set(entities["GPE"]))[:5]
        entities["DATE_TIME"] = list(set(entities["DATE_TIME"] + money))[:5]
        
        return entities

    def summarize_text(self, text: str):
        """Generates a smart extractive summary of the text."""
        if not text.strip():
            return "No content to summarize."
            
        # Clean text sentences
        if NLTK_AVAILABLE:
            try:
                sentences = sent_tokenize(text)
            except Exception:
                sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
        else:
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
            
        if len(sentences) <= 2:
            return text
            
        # Score sentences based on word frequencies
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        filtered_words = [w for w in words if w not in self.stopwords]
        word_frequencies = Counter(filtered_words)
        
        if not word_frequencies:
            return sentences[0]
            
        max_freq = max(word_frequencies.values())
        for word in word_frequencies:
            word_frequencies[word] = word_frequencies[word] / max_freq
            
        sentence_scores = {}
        for sent in sentences:
            sent_words = re.findall(r'\b[a-zA-Z]{3,}\b', sent.lower())
            score = sum(word_frequencies.get(w, 0) for w in sent_words)
            sentence_scores[sent] = score
            
        # Select the top sentences (e.g., 30% of original, min 2, max 3 sentences)
        num_summary_sentences = max(2, min(3, int(len(sentences) * 0.3)))
        sorted_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)
        summary_sentences = [item[0] for item in sorted_sentences[:num_summary_sentences]]
        
        # Re-order the summary sentences to maintain original timeline
        ordered_summary = [s for s in sentences if s in summary_sentences]
        
        return " ".join(ordered_summary)
