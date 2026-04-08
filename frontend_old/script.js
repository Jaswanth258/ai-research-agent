document.addEventListener('DOMContentLoaded', () => {
    const topicInput = document.getElementById('topicInput');
    const searchBtn = document.getElementById('searchBtn');
    const btnLoader = document.getElementById('btnLoader');
    const btnText = searchBtn.querySelector('.btn-text');
    const dashboard = document.getElementById('dashboard');
    const stepsList = document.getElementById('stepsList');
    const reportContent = document.getElementById('reportContent');
    
    // Metrics
    const mTime = document.getElementById('metricTime');
    const mPapers = document.getElementById('metricPapers');
    const mScore = document.getElementById('metricScore');

    searchBtn.addEventListener('click', async () => {
        const topic = topicInput.getMetadata;
        const topicValue = topicInput.value.trim();
        
        if (!topicValue) return;

        startLoading();

        try {
            const response = await fetch('/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topicValue })
            });

            const data = await response.json();
            
            if (response.ok) {
                renderResults(data);
            } else {
                showError(data.detail || 'Research failed');
            }
        } catch (err) {
            showError('Network error connection to backend');
        } finally {
            stopLoading();
        }
    });

    function startLoading() {
        searchBtn.disabled = true;
        btnLoader.style.display = 'block';
        btnText.style.opacity = '0.5';
        
        // Reset and show dashboard
        dashboard.style.display = 'grid';
        stepsList.innerHTML = '<li class="step-item active">Initializing agent...</li>';
        reportContent.innerHTML = '<div class="loading-placeholder">Researching... This may take a minute.</div>';
        
        mTime.textContent = '-';
        mPapers.textContent = '-';
        mScore.textContent = '-';
    }

    function stopLoading() {
        searchBtn.disabled = false;
        btnLoader.style.display = 'none';
        btnText.style.opacity = '1';
    }

    function renderResults(data) {
        // Render Metrics
        mTime.textContent = data.metrics.time_taken_sec + 's';
        mPapers.textContent = data.metrics.relevant_papers_found;
        mScore.textContent = data.metrics.top_relevance_score;

        // Render Steps
        stepsList.innerHTML = '';
        data.steps.forEach(step => {
            const li = document.createElement('li');
            li.className = 'step-item';
            li.textContent = step;
            stepsList.appendChild(li);
        });

        // Render Report (using marked.js)
        reportContent.innerHTML = marked.parse(data.report);
        
        // Final style tweaks
        dashboard.scrollIntoView({ behavior: 'smooth' });
    }

    function showError(msg) {
        reportContent.innerHTML = `<div class="error-box" style="color: #ef4444; padding: 2rem; text-align: center;">
            <p><strong>Error:</strong> ${msg}</p>
        </div>`;
    }
});
