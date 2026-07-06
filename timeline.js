// Redirect to detail page if query parameter is present (supports both id and event)
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id') || urlParams.get('event');
if (eventId) {
    window.location.href = `detail.html?id=${eventId}`;
}

const PRAGAMENT_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json";
const IMAGE_OVERRIDES_URL = "/api/image-overrides";

const ERA_COLORS = {
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

const GRADE_COLORS = {
    "Grade 6": "#4caf50",
    "Grade 7": "#ff9800",
    "Grade 8": "#2196f3",
    "Grade 9": "#3f51b5",
    "Grade 10": "#e91e63"
};

function processRawData(data, imageOverrides = {}) {
    const subtopics = data?.timeline?.subtopics || [];
    return subtopics.map((item, index) => {
        const eventId = index + 1;
        const subtopicName = item.subtopic_name || item.topic_name || "Untitled topic";
        const topicName = item.topic_name || "";
        const chapterName = item.chapter_name || "";
        const subtitle = [topicName, chapterName].filter(Boolean).join(" | ");

        let grade = String(item.grade || "").trim();
        if (grade && !grade.toLowerCase().startsWith("grade")) grade = `Grade ${grade}`;
        else if (!grade) grade = "Grade";

        const location = item.display_location || item.location || item.corridor_classroom_position || "Location not specified";
        const causeEffect = item.cause_effect || "Cause & effect details not available.";
        const color = ERA_COLORS[chapterName] || GRADE_COLORS[grade] || "#ff9800";

        const override = imageOverrides[eventId] || {};
        const imgSrc = override.image || item.image_url || item.image || item.gif_url || item.thumbnail_url || "";
        const isAi = override.is_ai_image ?? Boolean(imgSrc);

        return {
            id: eventId,
            title: subtopicName,
            topic_name: topicName,
            subtitle,
            year: item.year_period || "Period not specified",
            era: item.era || chapterName || "Timeline",
            cause_effect: causeEffect,
            location,
            geo_location: item.location || "",
            panel_position: item.corridor_classroom_position || "",
            grade,
            color,
            image: imgSrc,
            is_ai_image: isAi,
            event_type: item.event_type || "",
            theme: item.theme || "",
            icon: item.icon || "",
            people_involved: item.people_involved || [],
            organizations: item.organizations || [],
            cause: item.cause || "",
            what_happened: item.what_happened || "",
            immediate_effect: item.immediate_effect || "",
            long_term_impact: item.long_term_impact || "",
            keywords: item.keywords || [],
            vocabulary: item.vocabulary || [],
            did_you_know: item.did_you_know || "",
            think_about_it: item.think_about_it || "",
            quiz_question: item.quiz_question || "",
            quiz_answer: item.quiz_answer || "",
            exam_importance: item.exam_importance || ""
        };
    });
}

let allTopics = [];
let timelineMeta = {
    title: "CBSE Social Science History",
    description: "Full historical timeline with Grade, Chapter Name, Topic Name, Subtopic Name, Year/Period, Location, Cause & Effect, Corridor/Classroom Position, and Display Location"
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

function renderTimelineMessage(message, isLoading = false) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;
    let content = "";
    if (isLoading) {
        content = `
            <div class="timeline-loader" style="text-align: center; padding: 40px;">
                <img src="images/loading.gif" alt="Loading..." style="width: 50px; height: 50px; margin-bottom: 15px;">
                <p style="color: #b0bec5; font-size: 1.1rem;">${escapeHtml(message)}</p>
            </div>
        `;
    } else if (message.includes("Unable to load")) {
        content = `
            <div class="error-card" style="max-width: 600px; margin: 40px auto; padding: 35px 30px; background: rgba(239, 68, 68, 0.08); border: 1.5px dashed rgba(239, 68, 68, 0.3); border-radius: 20px; text-align: center; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="font-size: 50px; margin-bottom: 20px; filter: drop-shadow(0 4px 10px rgba(239,68,68,0.2));">🖥️</div>
                <h3 style="color: #ef4444; margin-bottom: 12px; font-size: 1.35rem; font-weight: 700; font-family: 'Poppins', sans-serif;">Server Connection Offline</h3>
                <p style="color: #b0bec5; font-size: 0.98rem; line-height: 1.6; margin-bottom: 25px;">
                    The interactive timeline needs to connect to the local museum server. Please ask your teacher or lab assistant to start the server by running <code>py server.py</code> in the project directory.
                </p>
                <div style="font-size: 0.82rem; color: #78909c; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 10px; font-family: monospace; display: inline-block; border: 1px solid rgba(255,255,255,0.05);">
                    Error: Failed to connect to server API
                </div>
            </div>
        `;
    } else {
        content = `<div class="timeline-message">${escapeHtml(message)}</div>`;
    }
    container.innerHTML = content;
}

async function loadTimelineData() {
    renderTimelineMessage("Loading timeline data...", true);

    try {
        // Fetch from Pragament and image overrides in parallel
        const [dataResponse, overridesResponse] = await Promise.all([
            fetch(PRAGAMENT_URL, { cache: "no-store" }),
            fetch(IMAGE_OVERRIDES_URL, { cache: "no-store" }).catch(() => null)
        ]);

        if (!dataResponse.ok) {
            throw new Error(`Failed to load data from Pragament: ${dataResponse.status}`);
        }

        const rawData = await dataResponse.json();
        const imageOverrides = overridesResponse?.ok ? await overridesResponse.json() : {};

        allTopics = processRawData(rawData, imageOverrides);

        if (allTopics.length === 0) {
            throw new Error("No events found in timeline data");
        }

        const titleEl = document.querySelector(".timeline-header h1 span");
        const subtitleEl = document.querySelector(".timeline-header .subtitle");
        if (titleEl) titleEl.textContent = timelineMeta.title;
        if (subtitleEl) {
            subtitleEl.textContent = `${timelineMeta.description} | ${allTopics.length} subtopics`;
        }

        renderTimelineView("all", "");
    } catch (error) {
        console.error("Failed to load timeline data:", error);
        renderTimelineMessage("Unable to load timeline data. Please check your internet connection.");
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
            topic.cause_effect.toLowerCase().includes(term) ||
            topic.year.toLowerCase().includes(term) ||
            topic.location.toLowerCase().includes(term)
        );
    }

    if (filteredTopics.length === 0) {
        renderTimelineMessage("No matching historical events found. Try a different search.");
        return;
    }

    let html = "";

    filteredTopics.forEach((topic, index) => {
        const side = index % 2 === 0 ? "left" : "right";

        let imageHtml = "";
        if (topic.image) {
            imageHtml = `
                <div class="card-image-container">
                    <img class="card-image" src="${topic.image}" alt="${escapeHtml(topic.title)}">
                    ${topic.icon ? `<div class="event-icon-overlay">${escapeHtml(topic.icon)}</div>` : ""}
                </div>
            `;
        }



        let peopleOrgsHtml = "";
        let people = topic.people_involved || [];
        let orgs = topic.organizations || [];
        if (people.length > 0 || orgs.length > 0) {
            let tagsHtml = "";
            people.forEach(p => tagsHtml += `<span class="person-tag">${escapeHtml(p)}</span>`);
            orgs.forEach(o => tagsHtml += `<span class="org-tag">${escapeHtml(o)}</span>`);
            peopleOrgsHtml = `
                <div class="people-org-section">
                    <div class="people-org-label">People & Organizations</div>
                    ${tagsHtml}
                </div>
            `;
        }

        let whatHappenedHtml = "";
        if (topic.what_happened) {
            whatHappenedHtml = `<div class="what-happened">${escapeHtml(topic.what_happened)}</div>`;
        } else {
            const causePreview = topic.cause_effect ? topic.cause_effect.substring(0, 100) : "";
            whatHappenedHtml = `<div class="cause-preview">📖 ${escapeHtml(causePreview)}${(topic.cause_effect && topic.cause_effect.length > 100) ? "..." : ""}</div>`;
        }

        let causeEffectBoxesHtml = "";
        if (topic.cause || topic.immediate_effect) {
            causeEffectBoxesHtml = `
                <div class="cause-effect-container">
                    ${topic.cause ? `
                    <div class="cause-box">
                        <span class="cause-effect-label">🔥 Cause</span>
                        ${escapeHtml(topic.cause)}
                    </div>
                    ` : ""}
                    ${(topic.cause && topic.immediate_effect) ? `<div class="arrow-box">→</div>` : ""}
                    ${topic.immediate_effect ? `
                    <div class="effect-box">
                        <span class="cause-effect-label">💥 Effect</span>
                        ${escapeHtml(topic.immediate_effect)}
                    </div>
                    ` : ""}
                </div>
            `;
        }



        let iconYearHtml = `📅 ${escapeHtml(topic.year)}`;
        if (!topic.image && topic.icon) {
             iconYearHtml = `${escapeHtml(topic.icon)} ${escapeHtml(topic.year)}`;
        }

        html += `
            <div class="timeline-item ${side}" data-id="${topic.id}">
                <div class="timeline-dot"></div>
                <span class="timeline-year-marker">${iconYearHtml}</span>
                <div class="timeline-content" style="border-left-color: ${topic.color}; --event-color: ${topic.color};">
                    ${imageHtml}
                    ${topic.topic_name ? `<div class="topic-label">${escapeHtml(topic.topic_name)}</div>` : ""}
                    <div class="title">${escapeHtml(topic.title)}</div>
                    
                    <div class="badges-row">
                        <span class="grade-badge">${escapeHtml(topic.grade)}</span>
                    </div>
                    
                    <div class="badges-row">
                        <span class="location-badge">📍 ${escapeHtml(topic.location)}</span>
                        ${topic.panel_position ? `<span class="panel-badge">🏛️ ${escapeHtml(topic.panel_position)}</span>` : ""}
                    </div>
                    
                    ${peopleOrgsHtml}
                    ${whatHappenedHtml}
                    ${causeEffectBoxesHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function initTimelineView() {
    loadTimelineData();

    const timelineContainer = document.getElementById("timelineContainer");
    if (timelineContainer) {
        timelineContainer.addEventListener("click", event => {
            const item = event.target.closest(".timeline-item");
            if (!item) return;

            const id = parseInt(item.dataset.id, 10);
            window.location.href = `detail.html?id=${id}`;
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
}

initTimelineView();
