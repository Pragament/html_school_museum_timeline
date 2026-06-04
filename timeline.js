const TIMELINE_API_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json";

let allTopics = [];
let timelineMeta = {};

const eraColors = {
    "Prehistory": "#8bc34a",
    "Ancient": "#cddc39",
    "Ancient India": "#8bc34a",
    "Global Trade": "#ffeb3b",
    "Medieval India": "#ff9800",
    "Mughal Empire": "#9c27b0",
    "Colonial India": "#2196f3",
    "Social Reform": "#00bcd4",
    "Indian Nationalism": "#e91e63",
    "World History": "#3f51b5"
};

const gradeColors = {
    "Grade 6": "#4caf50",
    "Grade 7": "#ff9800",
    "Grade 8": "#2196f3",
    "Grade 9": "#3f51b5",
    "Grade 10": "#e91e63"
};

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[char]));
}

function normalizeGrade(grade) {
    const gradeText = String(grade ?? "").trim();
    if (!gradeText) return "Grade";
    return gradeText.toLowerCase().startsWith("grade") ? gradeText : `Grade ${gradeText}`;
}

function normalizeTimelineTopic(topic, index) {
    const grade = normalizeGrade(topic.grade);
    const era = topic.chapter_name || "Timeline";
    const location = topic.display_location || topic.location || topic.corridor_classroom_position || "Location not specified";

    return {
        id: index + 1,
        title: topic.subtopic_name || topic.topic_name || "Untitled topic",
        subtitle: [topic.topic_name, topic.chapter_name].filter(Boolean).join(" | "),
        year: topic.year_period || "Period not specified",
        era,
        causeEffect: topic.cause_effect || "Cause & effect details not available.",
        location,
        grade,
        panelPosition: topic.corridor_classroom_position || "",
        color: eraColors[era] || gradeColors[grade] || "#ff9800"
    };
}

function renderTimelineMessage(message) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;
    container.innerHTML = `<div class="timeline-message">${escapeHtml(message)}</div>`;
}

async function loadTimelineData() {
    renderTimelineMessage("Loading timeline data...");

    try {
        const response = await fetch(TIMELINE_API_URL, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const timeline = data.timeline || {};
        const subtopics = Array.isArray(timeline.subtopics) ? timeline.subtopics : [];
        if (subtopics.length === 0) {
            throw new Error("API response did not include timeline subtopics");
        }

        timelineMeta = {
            title: timeline.title || "",
            description: timeline.description || "",
            totalSubtopics: timeline.total_subtopics || subtopics.length
        };
        allTopics = subtopics.map(normalizeTimelineTopic);

        const titleEl = document.querySelector(".timeline-header h1 span");
        const subtitleEl = document.querySelector(".timeline-header .subtitle");
        if (titleEl && timelineMeta.title) titleEl.textContent = timelineMeta.title;
        if (subtitleEl && timelineMeta.description) {
            subtitleEl.textContent = `${timelineMeta.description} | ${allTopics.length} subtopics`;
        }

        renderTimelineView("all", "");
    } catch (error) {
        console.error("Failed to load timeline data:", error);
        renderTimelineMessage("Unable to load timeline data from the API. Please check your connection and refresh.");
    }
}

function renderTimelineView(filterGrade = "all", searchTerm = "") {
    const container = document.getElementById("timelineContainer");
    if (!container) return;

    let filteredTopics = [...allTopics];

    if (filterGrade !== "all") {
        filteredTopics = filteredTopics.filter(topic => topic.grade === filterGrade || topic.grade.includes(filterGrade.replace("Grade ", "")));
    }

    if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        filteredTopics = filteredTopics.filter(topic =>
            topic.title.toLowerCase().includes(term) ||
            topic.subtitle.toLowerCase().includes(term) ||
            topic.causeEffect.toLowerCase().includes(term) ||
            topic.year.toLowerCase().includes(term) ||
            topic.location.toLowerCase().includes(term)
        );
    }

    if (filteredTopics.length === 0) {
        renderTimelineMessage("No matching historical events found. Try a different search.");
        return;
    }

    let html = "";
    let lastEra = "";

    filteredTopics.forEach((topic, index) => {
        if (topic.era !== lastEra) {
            const eraY = 25 + (index * 85);
            html += `<div class="era-label" style="top: ${eraY}px;">📌 ${escapeHtml(topic.era)}</div>`;
            lastEra = topic.era;
        }

        const side = index % 2 === 0 ? "left" : "right";
        const causePreview = topic.causeEffect.substring(0, 100);

        html += `
            <div class="timeline-item ${side}" data-id="${topic.id}">
                <div class="timeline-dot"></div>
                <div class="timeline-content" style="border-left-color: ${topic.color};">
                    <span class="year-badge">📅 ${escapeHtml(topic.year)}</span>
                    <div class="title">${escapeHtml(topic.title)}</div>
                    <div class="subtitle">${escapeHtml(topic.subtitle)}</div>
                    <div>
                        <span class="grade-badge">${escapeHtml(topic.grade)}</span>
                        <span class="location-badge">📍 ${escapeHtml(topic.location)}</span>
                    </div>
                    <div class="cause-preview">📖 ${escapeHtml(causePreview)}${topic.causeEffect.length > 100 ? "..." : ""}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function showModal(topic) {
    const modal = document.getElementById("modal");
    document.getElementById("modalTitle").textContent = topic.title;
    document.getElementById("modalYear").textContent = `📅 ${topic.year}`;
    document.getElementById("modalSubtitle").textContent = topic.subtitle;
    document.getElementById("modalCauseEffect").innerHTML = `<strong>📖 Cause & Effect:</strong><br><br>${escapeHtml(topic.causeEffect)}`;
    document.getElementById("modalLocation").textContent = `📍 Location: ${topic.location}${topic.panelPosition ? ` | ${topic.panelPosition}` : ""}`;
    document.getElementById("modalGrade").textContent = `🎓 ${topic.grade}`;
    modal.style.display = "flex";
}

function initTimelineView() {
    loadTimelineData();

    const timelineContainer = document.getElementById("timelineContainer");
    if (timelineContainer) {
        timelineContainer.addEventListener("click", event => {
            const item = event.target.closest(".timeline-item");
            if (!item) return;

            const id = parseInt(item.dataset.id, 10);
            const topic = allTopics.find(candidate => candidate.id === id);
            if (topic) showModal(topic);
        });
    }

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", event => {
            const activeFilter = document.querySelector(".filter-btn.active")?.dataset.grade || "all";
            renderTimelineView(activeFilter, event.target.value);
        });
    }

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(item => item.classList.remove("active"));
            button.classList.add("active");

            const grade = button.dataset.grade;
            const searchTerm = document.getElementById("searchInput")?.value || "";
            renderTimelineView(grade, searchTerm);
        });
    });

    const resetBtn = document.getElementById("resetTimeline");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            document.getElementById("searchInput").value = "";
            document.querySelectorAll(".filter-btn").forEach(button => button.classList.remove("active"));
            document.querySelector(".filter-btn[data-grade='all']").classList.add("active");
            renderTimelineView("all", "");
        });
    }

    const scrollBtn = document.getElementById("scrollToTop");
    if (scrollBtn) {
        scrollBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    const modal = document.getElementById("modal");
    const closeBtn = document.querySelector(".close");
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = "none";
        };
    }

    window.onclick = event => {
        if (event.target === modal) modal.style.display = "none";
    };
}

initTimelineView();
