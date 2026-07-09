// Redirect to detail page if query parameter is present (supports both id and event)
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id') || urlParams.get('event');
if (eventId) {
    const boardParam = urlParams.get('board') || localStorage.getItem("selectedCurriculum") || "cbse";
    window.location.href = `detail.html?board=${boardParam}&id=${eventId}`;
}

const PRAGAMENT_URL = "https://staticapis.pragament.com/lms/cbse/topic-timeline.json";
const IMAGE_OVERRIDES_URL = "/api/image-overrides";

// Read selected curriculum from localStorage (set by select.html)
const SELECTED_CURRICULUM = localStorage.getItem("selectedCurriculum") || "cbse";
const CURRICULUM_URL = localStorage.getItem("curriculumUrl") || PRAGAMENT_URL;
const CURRICULUM_LABEL = localStorage.getItem("curriculumLabel") || "CBSE";
const CURRICULUM_SUBTOPICS_KEY = localStorage.getItem("curriculumSubtopicsKey") || "subtopics";

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

function processRawData(data, imageOverrides = {}, subtopicsKey = null) {
    const key = subtopicsKey || CURRICULUM_SUBTOPICS_KEY;
    const subtopics = data?.timeline?.[key] || data?.timeline?.subtopics || data?.timeline?.topics || [];
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
    title: `${CURRICULUM_LABEL} Social Science History`,
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
        // Check sessionStorage cache first for instant load (bypassed on localhost for live edits)
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const cached = isLocalhost ? null : sessionStorage.getItem("pragamentCache");
        let rawData;

        if (cached) {
            rawData = JSON.parse(cached);
        } else {
            // Try server-side proxy first (avoids CORS), fall back to direct URL
            const proxyUrl = `/api/board/${SELECTED_CURRICULUM}`;
            let dataResponse = await fetch(proxyUrl, { cache: "no-store" }).catch(() => null);
            if (!dataResponse || !dataResponse.ok) {
                dataResponse = await fetch(CURRICULUM_URL, { cache: "no-store" });
            }
            if (!dataResponse.ok) {
                throw new Error(`Failed to load data: ${dataResponse.status}`);
            }
            rawData = await dataResponse.json();
            sessionStorage.setItem("pragamentCache", JSON.stringify(rawData));
        }

        // Fetch image overrides (fast, local server)
        let imageOverrides = {};
        try {
            const overridesResponse = await fetch(IMAGE_OVERRIDES_URL, { cache: "no-store" });
            if (overridesResponse.ok) imageOverrides = await overridesResponse.json();
        } catch (_) {}

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

        // Restore scroll position if returning from detail page
        const savedPos = sessionStorage.getItem("timelineScrollPos");
        if (savedPos) {
            sessionStorage.removeItem("timelineScrollPos");
            setTimeout(() => window.scrollTo({ top: parseInt(savedPos), behavior: "instant" }), 50);
        }
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

    // Check if Compare Mode is active
    if (activeCompareBoards.size > 0) {
        if (compareMode === "merged") {
            container.classList.add("compare-merged-active");
            container.classList.remove("compare-parallel-active");
        } else {
            container.classList.add("compare-parallel-active");
            container.classList.remove("compare-merged-active");
        }
        renderMultiBoardTimeline(filteredTopics, filterGrade, searchTerm);
        return;
    }
    
    container.classList.remove("compare-merged-active");
    container.classList.remove("compare-parallel-active");

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
            // Save scroll position before navigating to detail page
            sessionStorage.setItem("timelineScrollPos", window.scrollY);
            window.location.href = `detail.html?board=${SELECTED_CURRICULUM}&id=${id}`;
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

// ===== SECONDARY / COMPARE TIMELINES (ROW-BY-ROW SIDE-BY-SIDE) =====

const ALL_BOARDS = {
    cbse: {
        label: "CBSE",
        url: "https://staticapis.pragament.com/lms/cbse/topic-timeline.json",
        subtopicsKey: "subtopics",
        color: "#ff9800"
    },
    telangana: {
        label: "SCERT Telangana",
        url: "https://staticapis.pragament.com/lms/scert_telangana/topic-timeline.json",
        subtopicsKey: "topics",
        color: "#4caf50"
    },
    ap: {
        label: "SCERT AP",
        url: "https://staticapis.pragament.com/lms/scert_ap/topic-timeline.json",
        subtopicsKey: "topics",
        color: "#2196f3"
    }
};

let activeCompareBoards = new Set();
let compareMode = "parallel"; // "parallel" or "merged"
const secondaryCache = {};

function buildComparePanel() {
    const compareToggles = document.getElementById("compareToggles");
    if (!compareToggles) return;

    const secondaryBoards = Object.entries(ALL_BOARDS).filter(([key]) => key !== SELECTED_CURRICULUM);
    
    let html = `<div class="compare-checkboxes">`;
    html += secondaryBoards.map(([key, board]) => {
        const isChecked = activeCompareBoards.has(key);
        return `
            <label class="compare-checkbox-label" style="--board-color: ${board.color};">
                <input type="checkbox" value="${key}" ${isChecked ? "checked" : ""} onchange="toggleSecondaryBoard('${key}', this.checked)">
                <span class="custom-checkbox" style="${isChecked ? `background: ${board.color}; border-color: ${board.color};` : ''}">
                    ${isChecked ? '✓' : ''}
                </span>
                ${escapeHtml(board.label)}
            </label>
        `;
    }).join("");
    html += `</div>`;

    html += `
        <div class="compare-mode-toggle">
            <span class="mode-label">Mode:</span>
            <label class="mode-radio">
                <input type="radio" name="compareMode" value="parallel" ${compareMode === "parallel" ? "checked" : ""} onchange="setCompareMode('parallel')">
                Parallel View
            </label>
            <label class="mode-radio">
                <input type="radio" name="compareMode" value="merged" ${compareMode === "merged" ? "checked" : ""} onchange="setCompareMode('merged')">
                Merged View
            </label>
        </div>
    `;

    compareToggles.innerHTML = html;
}

async function fetchSecondaryData(key) {
    if (secondaryCache[key]) return secondaryCache[key];
    const board = ALL_BOARDS[key];
    try {
        const proxyUrl = `/api/board/${key}`;
        let res = await fetch(proxyUrl, { cache: "no-store" }).catch(() => null);
        if (!res || !res.ok) {
            res = await fetch(board.url, { cache: "no-store" });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const rawData = await res.json();
        
        // Fetch image overrides to enrich secondary board too
        let imageOverrides = {};
        try {
            const overridesResponse = await fetch(IMAGE_OVERRIDES_URL, { cache: "no-store" });
            if (overridesResponse.ok) imageOverrides = await overridesResponse.json();
        } catch (_) {}

        const processed = processRawData(rawData, imageOverrides, board.subtopicsKey);
        secondaryCache[key] = processed;
        return processed;
    } catch (err) {
        console.error(`Failed to load secondary board '${key}':`, err);
        return null;
    }
}

function parseYearToNum(str) {
    if (!str) return Infinity;
    let s = str.toLowerCase();
    
    // If it has a date/month pattern (e.g. "10 May 1857 CE" or "12 March 1930")
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const hasMonth = months.some(m => s.includes(m));
    
    let val;
    if (hasMonth) {
        // Find the last number in the string which represents the year
        const matches = s.match(/\b\d+\b/g);
        if (matches && matches.length > 0) {
            val = parseInt(matches[matches.length - 1]);
        }
    }
    
    if (val === undefined) {
        const m = s.match(/(\d[\d,.]*)/);
        if (!m) return Infinity;
        val = parseFloat(m[1].replace(/,/g, ""));
    }
    
    if (s.includes("million")) val *= 1000000;
    if (s.includes("bce") || s.includes("bc") || s.includes("ago")) {
        val = -val;
    }
    return val;
}

async function toggleSecondaryBoard(key, isChecked) {
    if (isChecked) {
        activeCompareBoards.add(key);
        renderTimelineMessage(`⏳ Loading comparison...`, true);
        await fetchSecondaryData(key); // Ensure data is fetched and cached
    } else {
        activeCompareBoards.delete(key);
    }
    
    // Rebuild panel to update checkbox styles
    buildComparePanel();

    const activeFilter = document.querySelector(".filter-btn.active")?.dataset.grade || "all";
    const searchTerm = document.getElementById("searchInput")?.value || "";
    renderTimelineView(activeFilter, searchTerm);
}

function setCompareMode(mode) {
    compareMode = mode;
    const activeFilter = document.querySelector(".filter-btn.active")?.dataset.grade || "all";
    const searchTerm = document.getElementById("searchInput")?.value || "";
    renderTimelineView(activeFilter, searchTerm);
}


function renderMultiBoardTimeline(filteredMainTopics, filterGrade, searchTerm) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;
    
    let activeBoardsData = [];
    
    activeBoardsData.push({
        key: SELECTED_CURRICULUM,
        board: { label: CURRICULUM_LABEL, color: "#ff9800", subtopicsKey: localStorage.getItem("curriculumSubtopicsKey") },
        events: filteredMainTopics,
        isPrimary: true
    });
    
    activeCompareBoards.forEach(key => {
        let secList = secondaryCache[key] || [];
        if (filterGrade !== "all") {
            secList = secList.filter(t => t.grade === filterGrade || t.grade.includes(filterGrade.replace("Grade ", "")));
        }
        if (searchTerm.trim() !== "") {
            const term = searchTerm.toLowerCase();
            secList = secList.filter(t => 
                t.title.toLowerCase().includes(term) ||
                (t.subtitle || "").toLowerCase().includes(term) ||
                (t.what_happened || "").toLowerCase().includes(term) ||
                (t.cause_effect || "").toLowerCase().includes(term) ||
                t.year.toLowerCase().includes(term) ||
                t.location.toLowerCase().includes(term)
            );
        }
        activeBoardsData.push({
            key: key,
            board: ALL_BOARDS[key],
            events: secList,
            isPrimary: false
        });
    });

    if (activeBoardsData.every(b => b.events.length === 0)) {
        renderTimelineMessage("No matching events found in selected curricula.");
        return;
    }

    if (compareMode === "merged") {
        renderMultiBoardMerged(activeBoardsData, container);
    } else {
        renderMultiBoardParallel(activeBoardsData, container);
    }
}

function renderMultiBoardMerged(activeBoardsData, container) {
    let allEvents = [];
    activeBoardsData.forEach(bData => {
        bData.events.forEach(e => {
            allEvents.push({
                ...e,
                _boardKey: bData.key,
                _boardLabel: bData.board.label,
                _boardColor: bData.board.color,
                _isPrimary: bData.isPrimary
            });
        });
    });

    allEvents.sort((a, b) => parseYearToNum(a.year) - parseYearToNum(b.year));

    let html = "";
    allEvents.forEach((topic, index) => {
        const side = index % 2 === 0 ? "left" : "right";
        const boardBadge = `<div class="board-badge" style="background: ${topic._boardColor}22; color: ${topic._boardColor}; border: 1px solid ${topic._boardColor}55;">${escapeHtml(topic._boardLabel)}</div>`;
        
        let iconYearHtml = `📅 ${escapeHtml(topic.year)}`;
        if (!topic.image && topic.icon) {
             iconYearHtml = `${escapeHtml(topic.icon)} ${escapeHtml(topic.year)}`;
        }

        const cardType = topic._isPrimary ? "main" : "secondary";
        const cardHtml = renderCompareCard(topic, cardType, topic._boardKey, boardBadge);

        html += `
            <div class="timeline-item ${side}" data-id="${topic.id}">
                <div class="timeline-dot" style="background: ${topic._boardColor}; border-color: ${topic._boardColor}"></div>
                <span class="timeline-year-marker">${iconYearHtml}</span>
                ${cardHtml}
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderMultiBoardParallel(activeBoardsData, container) {
    const rows = [];
    const usedEventIds = new Set();
    
    let allEventsFlat = [];
    activeBoardsData.forEach(bData => {
        bData.events.forEach(e => {
            allEventsFlat.push({ ...e, _bData: bData });
        });
    });
    allEventsFlat.sort((a, b) => parseYearToNum(a.year) - parseYearToNum(b.year));
    
    allEventsFlat.forEach(ev => {
        const eventIdStr = `${ev._bData.key}_${ev.id}`;
        if (usedEventIds.has(eventIdStr)) return;
        
        const num = parseYearToNum(ev.year);
        
        let matchedRow = null;
        for (let row of rows) {
            let isClose = false;
            if (num === Infinity || row.num === Infinity) {
                isClose = (num === row.num && ev.year === row.label);
            } else if (num < 0 && row.num < 0) {
                isClose = Math.abs(num - row.num) <= 200;
            } else if (num > 0 && row.num > 0) {
                isClose = Math.abs(num - row.num) <= 10;
            }
            if (isClose) {
                if (!row.events[ev._bData.key]) {
                    matchedRow = row;
                    break;
                }
            }
        }
        
        if (matchedRow) {
            matchedRow.events[ev._bData.key] = ev;
            usedEventIds.add(eventIdStr);
        } else {
            const newRow = { num: num, label: ev.year, events: {} };
            newRow.events[ev._bData.key] = ev;
            rows.push(newRow);
            usedEventIds.add(eventIdStr);
        }
    });
    
    rows.sort((a, b) => a.num - b.num);
    
    let html = `<div class="compare-row-multi">`;
    
    if (activeBoardsData.length > 1) {
        html += `<div class="multi-headers">`;
        activeBoardsData.forEach(bData => {
            html += `<div class="multi-header" style="color: ${bData.board.color}; border-bottom: 2px solid ${bData.board.color}">${escapeHtml(bData.board.label)}</div>`;
        });
        html += `</div>`;
    }
    
    rows.forEach(row => {
        let cellsHtml = "";
        activeBoardsData.forEach(bData => {
            const topic = row.events[bData.key];
            if (topic) {
                const cardType = bData.isPrimary ? "main" : "secondary";
                const boardBadge = `<div class="board-badge" style="background: ${bData.board.color}22; color: ${bData.board.color}; border: 1px solid ${bData.board.color}55;">${escapeHtml(bData.board.label)}</div>`;
                cellsHtml += `<div class="compare-cell multi-cell">${renderCompareCard(topic, cardType, bData.key, boardBadge)}</div>`;
            } else {
                cellsHtml += `<div class="compare-cell multi-cell"></div>`;
            }
        });
        
        const firstTopic = Object.values(row.events)[0];
        const color = firstTopic?.color || '#ff9800';
        
        html += `
            <div class="multi-row-group" style="--badge-color: ${color}; --badge-glow: ${color}33; flex-direction: column;">
                <div class="multi-year-top">
                    <span class="compare-year-badge">${escapeHtml(row.label)}</span>
                </div>
                <div class="multi-cells-container">
                    ${cellsHtml}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    
    container.innerHTML = html;
}

function renderCompareCard(topic, type, boardKey = null, boardBadgeHtml = "") {
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

    const clickAction = type === "main" 
        ? `onclick="navigateMainEvent(${topic.id})"` 
        : `onclick="navigateSecondaryEvent(${topic.id}, '${boardKey}', event)"`;

    return `
        <div class="timeline-content" ${clickAction} style="border-left-color: ${topic.color}; --event-color: ${topic.color}; border-right-color: ${topic.color};">
            ${boardBadgeHtml}
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
    `;
}

function navigateMainEvent(id) {
    sessionStorage.setItem("timelineScrollPos", window.scrollY);
    window.location.href = `detail.html?board=${SELECTED_CURRICULUM}&id=${id}`;
}

function navigateSecondaryEvent(id, boardKey, e) {
    e.stopPropagation();
    const board = ALL_BOARDS[boardKey];
    const prevCurriculum = localStorage.getItem("selectedCurriculum");
    const prevUrl = localStorage.getItem("curriculumUrl");
    const prevLabel = localStorage.getItem("curriculumLabel");
    const prevKey = localStorage.getItem("curriculumSubtopicsKey");

    localStorage.setItem("selectedCurriculum", boardKey);
    localStorage.setItem("curriculumUrl", board.url);
    localStorage.setItem("curriculumLabel", board.label);
    localStorage.setItem("curriculumSubtopicsKey", board.subtopicsKey);
    sessionStorage.removeItem("pragamentCache");

    sessionStorage.setItem("returnCurriculum", prevCurriculum || "");
    sessionStorage.setItem("returnUrl", prevUrl || "");
    sessionStorage.setItem("returnLabel", prevLabel || "");
    sessionStorage.setItem("returnKey", prevKey || "");
    sessionStorage.setItem("timelineScrollPos", window.scrollY);

    window.location.href = `detail.html?board=${boardKey}&id=${id}`;
}

// Wire up compare panel on DOM content load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(buildComparePanel, 300);
});
