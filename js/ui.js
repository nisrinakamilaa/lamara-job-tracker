window.downloadCv = async function(jobId) {
    try {
        const record = await CVStore.get(jobId);
        if (!record) {
            alert("CV file not found in browser storage.");
            return;
        }

        // Convert base64 data to blob
        const fetchResponse = await fetch(record.fileData);
        const blob = await fetchResponse.blob();
        
        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.fileName || 'cv.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Error downloading CV:", e);
        alert("Failed to download CV file.");
    }
};

function openDrawer() {
    sideDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
}

function closeDrawer() {
    sideDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    jobForm.reset();

    // Reset status dropdown visually
    const formDropdownSelected = document.getElementById('formDropdownSelected');
    const formDropdownItems = document.querySelectorAll('#formDropdownList li');
    if (formDropdownSelected) formDropdownSelected.textContent = 'Applied';
    formDropdownItems.forEach(li => {
        if (li.dataset.value === 'applied') li.classList.add('selected');
        else li.classList.remove('selected');
    });
    const jobStatusInput = document.getElementById('jobStatus');
    if (jobStatusInput) jobStatusInput.value = 'applied';

    // Reset priority dropdown visually
    const priorityDropdownSelected = document.getElementById('priorityDropdownSelected');
    const priorityDropdownItems = document.querySelectorAll('#priorityDropdownList li');
    if (priorityDropdownSelected) priorityDropdownSelected.textContent = 'Medium';
    priorityDropdownItems.forEach(li => {
        if (li.dataset.value === 'Medium') li.classList.add('selected');
        else li.classList.remove('selected');
    });
    const jobPriorityInput = document.getElementById('jobPriority');
    if (jobPriorityInput) jobPriorityInput.value = 'Medium';

    if (window.updateVisualPipeline) {
        window.updateVisualPipeline('applied');
    }

    if (window.resetAllCustomDatePickers) {
        window.resetAllCustomDatePickers();
    }

    const timelineContainer = document.getElementById('statusHistoryTimeline');
    if (timelineContainer) timelineContainer.innerHTML = '';
    window.currentEditStatusHistory = [];
}

// Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const url = document.getElementById('jobUrl').value;
    const title = document.getElementById('jobTitle').value;
    const company = document.getElementById('jobCompany').value;
    const status = document.getElementById('jobStatus').value;
    const date = document.getElementById('jobDate').value;
    const location = document.getElementById('jobLocation').value;
    const platform = document.getElementById('jobPlatform').value;
    
    // New Fields
    const priority = document.getElementById('jobPriority') ? document.getElementById('jobPriority').value : 'Medium';
    const deadline = document.getElementById('jobDeadline') ? document.getElementById('jobDeadline').value : '';
    const followUp = document.getElementById('jobFollowUp') ? document.getElementById('jobFollowUp').value : '';
    const reminderNotes = document.getElementById('jobReminderNotes') ? document.getElementById('jobReminderNotes').value : '';
    const descSummary = document.getElementById('jobDescSummary') ? document.getElementById('jobDescSummary').value : '';
    const cvVersion = '';
    const salary = document.getElementById('jobSalary') ? document.getElementById('jobSalary').value : '';
    const interviewNotes = document.getElementById('jobInterviewNotes') ? document.getElementById('jobInterviewNotes').value : '';

    const cvFileInput = document.getElementById('jobCvFile');
    const cvFile = cvFileInput ? cvFileInput.files[0] : null;
    const hasCvFile = !!cvFile;
    const jobId = currentEditJobId ? currentEditJobId : Date.now().toString();

    let statusHistory = [];
    if (currentEditJobId) {
        statusHistory = [...(window.currentEditStatusHistory || [])];
        
        if (statusHistory.length > 0 && statusHistory[statusHistory.length - 1].status !== status) {
            statusHistory.push({ status: status, date: new Date().toISOString() });
        }
    } else {
        statusHistory = [{ status: status, date: new Date().toISOString() }];
    }

    const newJob = {
        id: jobId,
        url,
        title,
        company,
        status,
        date: date || new Date().toISOString().split('T')[0],
        location,
        platform,
        priority,
        deadline,
        followUp,
        reminderNotes,
        descSummary,
        cvVersion,
        salary,
        interviewNotes,
        statusHistory,
        hasCvFile: hasCvFile ? true : (removeCvFile ? false : (currentEditJobId ? (jobs.find(j => j.id === currentEditJobId) || {}).hasCvFile : false))
    };

    if (hasCvFile) {
        try {
            const fileData = await readFileAsDataURL(cvFile);
            await CVStore.save(jobId, cvFile.name, cvFile.type, fileData);
        } catch (err) {
            console.error("Failed to save CV file:", err);
            alert("Warning: Failed to save CV file. Job will be added without the file.");
            newJob.hasCvFile = false;
        }
    } else if (removeCvFile && currentEditJobId) {
        await CVStore.delete(currentEditJobId).catch(err => console.error("Error clearing CV file:", err));
    }

    if (currentEditJobId) {
        const index = jobs.findIndex(j => j.id === currentEditJobId);
        if (index !== -1) jobs[index] = newJob;
    } else {
        jobs.push(newJob);
    }

    try {
        if (remoteReady && currentUser) {
            await saveJobToSupabase(newJob);
        }
        saveToLocalStorage();
        closeDrawer();
        renderList();
    } catch (err) {
        console.error('Failed to sync job:', err);
        saveToLocalStorage();
        closeDrawer();
        renderList();
        alert('Saved locally, but cloud sync failed. Please try again.');
    }
}


function renderList() {
    listBody.innerHTML = '';

    const dashboardSection = document.querySelector('.dashboard-section');
    if (dashboardSection) {
        dashboardSection.classList.toggle('has-data', jobs.length > 0);
    }

    // Update Dashboard Cards
    if (window.updateDashboardCards) {
        window.updateDashboardCards();
    }

    // Apply Filters & Search
    let filteredJobs = jobs.filter(job => {
        const matchFilter = currentFilter === 'all' || job.status === currentFilter;
        const matchSearch = job.title.toLowerCase().includes(searchQuery) || 
                            job.company.toLowerCase().includes(searchQuery);
        return matchFilter && matchSearch;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return String(b.id).localeCompare(String(a.id));
    });

    // Adjust currentPage boundary
    const totalPages = Math.ceil(filteredJobs.length / rowsPerPage) || 1;
    currentPage = Math.min(currentPage, totalPages);

    // Update Analytics Chart
    if (window.renderAnalytics) {
        window.renderAnalytics(filteredJobs);
    }

    if (filteredJobs.length === 0) {
        const controls = document.getElementById('paginationControls');
        if (controls) controls.style.display = 'none';

        // Show empty state clone or loading
        if (isInitialLoad) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'empty-state';
            loadingDiv.innerHTML = '<p>Loading your data...</p><span>Please wait a moment.</span>';
            listBody.appendChild(loadingDiv);
        } else {
            const clone = emptyStateTemplate.content.cloneNode(true);
            // Modify text if it's just filtered out vs completely empty
            if (jobs.length > 0) {
                clone.querySelector('p').textContent = "No jobs match your search.";
                clone.querySelector('span').textContent = "Try changing your filters.";
            }
            listBody.appendChild(clone);
            lucide.createIcons();
        }
        return;
    }

    // Slice for current page
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedJobs = filteredJobs.slice(startIndex, startIndex + rowsPerPage);

    // Render Rows for current page
    paginatedJobs.forEach(job => {
        const row = createJobRow(job);
        listBody.appendChild(row);
    });

    // Update Pagination Controls
    updatePaginationControls(filteredJobs.length);

    // Re-initialize any new icons
    lucide.createIcons();
}

function updatePaginationControls(totalItems) {
    const controls = document.getElementById('paginationControls');
    if (!controls) return;
    
    controls.innerHTML = '';
    
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (totalPages <= 1) {
        controls.style.display = 'none';
        return;
    }
    controls.style.display = 'flex';
    
    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderList();
        }
    });
    controls.appendChild(prevBtn);
    
    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${currentPage === i ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderList();
        });
        controls.appendChild(btn);
    }
    
    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderList();
        }
    });
    controls.appendChild(nextBtn);
}

function createJobRow(job) {
    const row = document.createElement('div');
    row.className = 'job-row';
    
    // Fallback date format with validation
    const dateObj = parseValidDate(job.date);
    const formattedDate = dateObj 
        ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '-';

    const statusInfo = CONSTANTS.STATUS_MAP[job.status] || { label: job.status, badgeClass: '' };

    // Format Priority
    const priority = job.priority || 'Medium';
    const priorityClass = `priority-${String(priority).replace(/[^\w-]/g, '')}`;
    const jobIdForJs = escapeHTML(escapeJsString(job.id));
    const urlForJs = escapeHTML(escapeJsString(job.url));
    const titleText = escapeHTML(job.title);
    const companyText = escapeHTML(job.company);
    const platformText = escapeHTML(job.platform);
    const locationText = escapeHTML(job.location);
    const statusText = escapeHTML(statusInfo.label);
    const priorityText = escapeHTML(priority);

    // Format Location (Only show location)
    let locationHtml = '';
    if (job.location && job.location.trim() !== '') {
        locationHtml = `<div class="row-location"><i data-lucide="map-pin"></i> ${locationText}</div>`;
    } else {
        locationHtml = `<span style="color:var(--border-color)">-</span>`;
    }

    row.innerHTML = `
        <div class="row-position">
            <strong title="${titleText}">${titleText}</strong>
            <span class="company-info" title="${companyText}">
                <i data-lucide="building-2"></i> <span class="company-name">${companyText}</span>
                ${job.platform ? `<span class="platform-badge">via ${platformText}</span>` : ''}
            </span>
        </div>
        <div class="row-status">
            <span class="status-badge ${statusInfo.badgeClass}">${statusText}</span>
        </div>
        <div class="col-priority">
            <span class="priority-badge ${priorityClass}">${priorityText}</span>
        </div>
        <div class="col-next-step" title="${locationText}">
            ${locationHtml}
        </div>
        <div class="row-date">
            ${formattedDate}
        </div>
        <div class="row-actions">
            ${job.hasCvFile ? `
                <button title="Download CV" onclick="downloadCv('${jobIdForJs}')">
                    <i data-lucide="file-text"></i>
                </button>
            ` : ''}
            ${job.url ? `
                <button title="View Link" onclick="window.open('${urlForJs}', '_blank')">
                    <i data-lucide="external-link"></i>
                </button>
            ` : ''}
            <button title="Edit" onclick="editJob('${jobIdForJs}')">
                <i data-lucide="pencil"></i>
            </button>
            <button title="Delete" onclick="deleteJob('${jobIdForJs}')">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `;
    
    return row;
}

window.currentEditStatusHistory = [];

function renderStatusHistory() {
    const container = document.getElementById('statusHistoryTimeline');
    if (!container) return;
    container.innerHTML = '';

    const history = window.currentEditStatusHistory;
    if (!history || history.length === 0) return;

    window.currentEditStatusHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    window.currentEditStatusHistory.forEach((item, index) => {
        let durationText = '';
        if (index > 0) {
            const prevDate = new Date(window.currentEditStatusHistory[index - 1].date);
            const currDate = new Date(item.date);
            const diffTime = Math.abs(currDate - prevDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                durationText = 'Same day';
            } else {
                durationText = `+ ${diffDays} day${diffDays > 1 ? 's' : ''}`;
            }
        }

        const dateObj = new Date(item.date);
        const formattedDateValue = !isNaN(dateObj) ? dateObj.toISOString().split('T')[0] : '';
        const displayDate = !isNaN(dateObj) ? `${String(dateObj.getDate()).padStart(2, '0')} / ${String(dateObj.getMonth() + 1).padStart(2, '0')} / ${dateObj.getFullYear()}` : '-';
        const mappedLabel = CONSTANTS.STATUS_MAP[item.status] ? CONSTANTS.STATUS_MAP[item.status].label : item.status;
        const mappedLabelText = escapeHTML(mappedLabel);

        const deleteBtnHtml = index > 0 ? `<button type="button" class="btn-remove-status" onclick="window.removeStatusHistory(${index})" title="Remove this status"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>` : '';

        const el = document.createElement('div');
        el.className = 'timeline-item';
        el.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <span class="timeline-status">${mappedLabelText}</span>
                <div class="custom-date-picker timeline-custom-date" style="position: relative;">
                    <div class="date-input-wrapper timeline-date-wrapper" style="border: none; background: transparent; padding: 0; min-height: auto; width: fit-content; gap: 4px;" title="Click to edit date" onclick="this.querySelector('.styled-date-display').click()">
                        <input type="text" class="styled-date-display timeline-date-text" readonly style="border: none; background: transparent; padding: 0; font-size: 11px; color: var(--text-muted); cursor: pointer; width: 75px; text-overflow: ellipsis; white-space: nowrap;" value="${displayDate}">
                        <input type="hidden" class="styled-date-hidden" value="${formattedDateValue}" onchange="window.updateStatusHistoryDate(${index}, this.value)">
                        <i data-lucide="pencil" class="calendar-icon edit-date-icon" style="width: 11px; height: 11px; opacity: 0.6; position: static; transform: none; color: var(--text-muted); margin: 0; pointer-events: none;"></i>
                    </div>
                    <div class="calendar-dropdown" style="top: 100%; right: auto; left: 0;">
                        <div class="calendar-header">
                            <button type="button" class="calPrevBtn"><i data-lucide="chevron-left"></i></button>
                            <span class="cal-month-year calMonthYear"></span>
                            <button type="button" class="calNextBtn"><i data-lucide="chevron-right"></i></button>
                        </div>
                        <div class="calendar-weekdays">
                            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                        </div>
                        <div class="calendar-days calDays"></div>
                        <div class="calendar-footer">
                            <button type="button" class="cal-btn-clear calClearBtn">Clear</button>
                            <button type="button" class="cal-btn-today calTodayBtn">Today</button>
                        </div>
                    </div>
                </div>
                ${durationText ? `<span class="timeline-duration">${durationText}</span>` : ''}
            </div>
            ${deleteBtnHtml}
        `;
        container.appendChild(el);
    });

    if (window.lucide) {
        window.lucide.createIcons({ nameAttr: 'data-lucide' });
    }
    
    // Re-initialize any new custom date pickers added
    initCustomDatePicker();
}

window.removeStatusHistory = function(index) {
    if (!window.currentEditStatusHistory || index === 0 || index >= window.currentEditStatusHistory.length) return;
    
    window.currentEditStatusHistory.splice(index, 1);
    
    if (index === window.currentEditStatusHistory.length) {
        const newLastStatus = window.currentEditStatusHistory[window.currentEditStatusHistory.length - 1].status;
        
        const statusInput = document.getElementById('jobStatus');
        if (statusInput) statusInput.value = newLastStatus;
        
        const formDropdownSelected = document.getElementById('formDropdownSelected');
        const formDropdownItems = document.querySelectorAll('#formDropdownList li');
        if (formDropdownSelected) {
            formDropdownSelected.textContent = CONSTANTS.STATUS_MAP[newLastStatus] ? CONSTANTS.STATUS_MAP[newLastStatus].label : 'Applied';
        }
        formDropdownItems.forEach(li => {
            if (li.dataset.value === newLastStatus) li.classList.add('selected');
            else li.classList.remove('selected');
        });
        if (window.updateVisualPipeline) window.updateVisualPipeline(newLastStatus);
    }
    
    renderStatusHistory();
};

window.updateStatusHistoryDate = function(index, newDateStr) {
    if (!window.currentEditStatusHistory || index < 0 || index >= window.currentEditStatusHistory.length) return;
    
    const newDate = new Date(newDateStr);
    if (!isNaN(newDate)) {
        // Keep the existing time part by updating only year, month, date.
        // But since this is a simple tracker, setting the ISO string is sufficient.
        window.currentEditStatusHistory[index].date = newDate.toISOString();
        renderStatusHistory();
    }
};

window.deleteJob = async function(id) {
    if (confirm('Are you sure you want to remove this job?')) {
        jobs = jobs.filter(j => j.id !== id);
        saveToLocalStorage();
        renderList();

        if (remoteReady && supabaseClient && currentUser) {
            const { error } = await supabaseClient
                .from('jobs')
                .delete()
                .eq('id', id)
                .eq('user_id', currentUser.id);

            if (error) {
                console.error('Failed to delete cloud job:', error);
                alert('Deleted locally, but cloud delete failed. Please try again.');
            }
        }
        
        // Clean up stored CV if it exists
        CVStore.delete(id).catch(err => console.error("Error clearing CV file:", err));
    }
};

window.markCvForRemoval = function() {
    removeCvFile = true;
    const cvStatus = document.getElementById('cvFileStatus');
    const cvInput = document.getElementById('jobCvFile');
    if (cvInput) {
        cvInput.style.display = 'block';
        cvInput.value = '';
    }
    if (cvStatus) {
        cvStatus.innerHTML = `<span style="color: var(--danger); font-size: 12px;"><i data-lucide="info" style="width: 14px; height: 14px; vertical-align: middle;"></i> Old CV will be removed on save</span>`;
        lucide.createIcons();
    }
};

window.editJob = function(id) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    currentEditJobId = id;
    removeCvFile = false;
    
    const cvStatus = document.getElementById('cvFileStatus');
    const cvInput = document.getElementById('jobCvFile');
    if (cvStatus) {
        if (job.hasCvFile) {
            if (cvInput) cvInput.style.display = 'none';
            cvStatus.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-md); width: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; color: var(--primary);">
                        <i data-lucide="file-check" style="width: 16px; height: 16px;"></i> 
                        <span style="font-weight: 500; font-size: 13px;">CV Attached</span>
                    </div>
                    <button type="button" class="btn-sm danger" style="padding: 4px; border: none; background: transparent; color: var(--danger); cursor: pointer;" onclick="window.markCvForRemoval()" title="Remove CV">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            `;
        } else {
            if (cvInput) cvInput.style.display = 'block';
            cvStatus.innerHTML = '';
        }
        lucide.createIcons();
    }
    
    document.querySelector('.drawer-header h3').textContent = 'Edit Opportunity';
    const saveBtn = jobForm.querySelector('button[type="submit"]');
    if(saveBtn) saveBtn.textContent = 'Update Job';

    // populate form
    document.getElementById('jobUrl').value = job.url || '';
    document.getElementById('jobTitle').value = job.title || '';
    document.getElementById('jobCompany').value = job.company || '';
    document.getElementById('jobLocation').value = job.location || '';
    document.getElementById('jobPlatform').value = job.platform || '';
    
    // Priority
    const priorityInput = document.getElementById('jobPriority');
    if (priorityInput) priorityInput.value = job.priority || 'Medium';
    const priorityDropdownSelected = document.getElementById('priorityDropdownSelected');
    if (priorityDropdownSelected) priorityDropdownSelected.textContent = job.priority || 'Medium';
    const priorityDropdownItems = document.querySelectorAll('#priorityDropdownList li');
    priorityDropdownItems.forEach(li => {
        if (li.dataset.value === (job.priority || 'Medium')) li.classList.add('selected');
        else li.classList.remove('selected');
    });

    // Status
    const statusInput = document.getElementById('jobStatus');
    if (statusInput) statusInput.value = job.status || 'applied';
    const formDropdownSelected = document.getElementById('formDropdownSelected');
    const formDropdownItems = document.querySelectorAll('#formDropdownList li');
    if (formDropdownSelected) {
        const mappedLabel = CONSTANTS.STATUS_MAP[job.status] ? CONSTANTS.STATUS_MAP[job.status].label : 'Applied';
        formDropdownSelected.textContent = mappedLabel;
    }
    formDropdownItems.forEach(li => {
        if (li.dataset.value === (job.status || 'applied')) li.classList.add('selected');
        else li.classList.remove('selected');
    });
    if (window.updateVisualPipeline) window.updateVisualPipeline(job.status || 'applied');

    // Dates
    if (job.date) {
        document.getElementById('jobDate').value = job.date;
        const d = new Date(job.date);
        if (!isNaN(d)) {
            const displayDate = `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`;
            document.querySelector('#jobDate').previousElementSibling.value = displayDate;
        }
    }
    if (job.deadline) {
        document.getElementById('jobDeadline').value = job.deadline;
        const d = new Date(job.deadline);
        if (!isNaN(d)) {
            document.querySelector('#jobDeadline').previousElementSibling.value = `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`;
        }
    }
    if (job.followUp) {
        document.getElementById('jobFollowUp').value = job.followUp;
        const d = new Date(job.followUp);
        if (!isNaN(d)) {
            document.querySelector('#jobFollowUp').previousElementSibling.value = `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`;
        }
    }

    document.getElementById('jobReminderNotes').value = job.reminderNotes || '';
    document.getElementById('jobDescSummary').value = job.descSummary || '';
    document.getElementById('jobSalary').value = job.salary || '';
    document.getElementById('jobInterviewNotes').value = job.interviewNotes || '';

    if (job.statusHistory) {
        window.currentEditStatusHistory = JSON.parse(JSON.stringify(job.statusHistory));
    } else {
        window.currentEditStatusHistory = [{ status: job.status, date: job.date || new Date().toISOString() }];
    }
    renderStatusHistory();

    openDrawer();
};


let currentCalDate = new Date();
let selectedCalDate = new Date();

function initCustomDatePicker() {
    const pickers = document.querySelectorAll('.custom-date-picker');
    
    pickers.forEach(picker => {
        if (picker.dataset.initialized) return;
        picker.dataset.initialized = 'true';

        const displayInput = picker.querySelector('.styled-date-display');
        const hiddenInput = picker.querySelector('.styled-date-hidden');
        const dropdown = picker.querySelector('.calendar-dropdown');
        const calMonthYear = picker.querySelector('.calMonthYear');
        const calendarDays = picker.querySelector('.calDays');
        const prevBtn = picker.querySelector('.calPrevBtn');
        const nextBtn = picker.querySelector('.calNextBtn');
        const clearBtn = picker.querySelector('.calClearBtn');
        const todayBtn = picker.querySelector('.calTodayBtn');

        let currentCalDate = new Date();
        let selectedCalDate = null;

        // Default Date Applied to today if empty
        if (hiddenInput.id === 'jobDate' && !hiddenInput.value) {
            selectedCalDate = new Date();
            const yyyy = selectedCalDate.getFullYear();
            const mm = String(selectedCalDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedCalDate.getDate()).padStart(2, '0');
            hiddenInput.value = `${yyyy}-${mm}-${dd}`;
            displayInput.value = `${dd} / ${mm} / ${yyyy}`;
        } else if (hiddenInput.value) {
            const parsed = new Date(hiddenInput.value);
            if (!isNaN(parsed)) {
                selectedCalDate = parsed;
                currentCalDate = parsed;
            }
        }

        // Toggle dropdown
        displayInput.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-date-picker.open').forEach(p => {
                if (p !== picker) p.classList.remove('open');
            });
            picker.classList.toggle('open');
            if (picker.classList.contains('open')) renderCalendar();
        });

        // Month Navigation
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderCalendar();
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderCalendar();
        });

        // Clear Button
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            selectedCalDate = null;
            hiddenInput.value = '';
            displayInput.value = '';
            picker.classList.remove('open');
            renderCalendar();
            hiddenInput.dispatchEvent(new Event('change'));
        });

        // Today Button
        todayBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            selectDate(new Date());
        });

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        function renderCalendar() {
            const year = currentCalDate.getFullYear();
            const month = currentCalDate.getMonth();

            calMonthYear.textContent = `${monthNames[month]} ${year}`;

            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDay = new Date(year, month + 1, 0).getDate();
            const prevLastDay = new Date(year, month, 0).getDate();

            calendarDays.innerHTML = "";

            // Prev month days
            for (let x = firstDayIndex; x > 0; x--) {
                const daySpan = document.createElement("span");
                daySpan.classList.add("prev-month");
                const dayNum = prevLastDay - x + 1;
                daySpan.textContent = dayNum;
                daySpan.addEventListener('click', (e) => {
                    e.stopPropagation(); selectDate(new Date(year, month - 1, dayNum));
                });
                calendarDays.appendChild(daySpan);
            }

            // Current month days
            const today = new Date();
            for (let i = 1; i <= lastDay; i++) {
                const daySpan = document.createElement("span");
                daySpan.textContent = i;
                const d = new Date(year, month, i);

                if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                    daySpan.classList.add("today");
                }
                if (selectedCalDate && d.getDate() === selectedCalDate.getDate() && d.getMonth() === selectedCalDate.getMonth() && d.getFullYear() === selectedCalDate.getFullYear()) {
                    daySpan.classList.add("selected");
                }

                daySpan.addEventListener('click', (e) => {
                    e.stopPropagation(); selectDate(new Date(year, month, i));
                });
                calendarDays.appendChild(daySpan);
            }

            // Next month days
            const totalSlots = 42;
            const currentSlots = firstDayIndex + lastDay;
            const nextMonthDays = totalSlots - currentSlots;
            for (let j = 1; j <= nextMonthDays; j++) {
                const daySpan = document.createElement("span");
                daySpan.classList.add("next-month");
                daySpan.textContent = j;
                daySpan.addEventListener('click', (e) => {
                    e.stopPropagation(); selectDate(new Date(year, month + 1, j));
                });
                calendarDays.appendChild(daySpan);
            }
            
            setTimeout(() => { lucide.createIcons(); }, 0);
        }

        function selectDate(date) {
            selectedCalDate = new Date(date);
            currentCalDate = new Date(date);

            const yyyy = selectedCalDate.getFullYear();
            const mm = String(selectedCalDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedCalDate.getDate()).padStart(2, '0');
            
            hiddenInput.value = `${yyyy}-${mm}-${dd}`;
            displayInput.value = `${dd} / ${mm} / ${yyyy}`;
            
            picker.classList.remove('open');
            renderCalendar();
            
            hiddenInput.dispatchEvent(new Event('change'));
        }

        picker.setCustomDate = function(dateStr) {
            if (!dateStr) {
                selectedCalDate = null;
                hiddenInput.value = '';
                displayInput.value = '';
            } else {
                selectDate(new Date(dateStr));
            }
        };

        renderCalendar();
    });

    if (!window.customDatePickerDocListenerAdded) {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.custom-date-picker').forEach(picker => {
                if (!picker.contains(e.target)) {
                    picker.classList.remove('open');
                }
            });
        });
        window.customDatePickerDocListenerAdded = true;
    }

    window.resetAllCustomDatePickers = function() {
        document.querySelectorAll('.custom-date-picker').forEach(picker => {
            if (picker.setCustomDate) {
                const hiddenInput = picker.querySelector('.styled-date-hidden');
                if (hiddenInput && hiddenInput.id === 'jobDate') {
                    picker.setCustomDate(new Date().toISOString().split('T')[0]);
                } else {
                    picker.setCustomDate(null);
                }
            }
        });
    };
}

// Custom Location Autocomplete with Indonesian Cities and Workspace Modes
function initLocationAutocomplete() {
    const jobLocation = document.getElementById('jobLocation');
    const locationDropdown = document.getElementById('locationDropdown');
    
    if (!jobLocation || !locationDropdown) return;

    const LOCATIONS = [
        // Work Modes
        "Remote", "Hybrid", "On-site", "WFH", "WFO",
        // DKI Jakarta
        "Jakarta", "Jakarta Barat", "Jakarta Pusat", "Jakarta Selatan", "Jakarta Timur", "Jakarta Utara",
        // Jawa Barat
        "Bandung", "Kota Bandung", "Kabupaten Bandung", "Bandung Barat", "Bekasi", "Kota Bekasi", "Kabupaten Bekasi",
        "Bogor", "Kota Bogor", "Kabupaten Bogor", "Depok", "Cimahi", "Tasikmalaya", "Sukabumi",
        "Cianjur", "Garut", "Sumedang", "Subang", "Purwakarta", "Karawang", "Cikarang",
        "Cirebon", "Kuningan", "Majalengka", "Indramayu", "Pangandaran", "Ciamis", "Banjar",
        // Banten
        "Tangerang", "Kota Tangerang", "Tangerang Selatan", "Serang", "Cilegon", "Pandeglang", "Lebak",
        // Jawa Tengah
        "Semarang", "Kota Semarang", "Kabupaten Semarang", "Surakarta", "Solo", "Salatiga",
        "Magelang", "Pekalongan", "Tegal", "Purwokerto", "Banyumas", "Cilacap", "Kebumen",
        "Purworejo", "Wonosobo", "Temanggung", "Kendal", "Batang", "Pemalang", "Brebes",
        "Demak", "Kudus", "Jepara", "Pati", "Rembang", "Blora", "Grobogan", "Sragen",
        "Karanganyar", "Sukoharjo", "Wonogiri", "Klaten", "Boyolali",
        // DIY
        "Yogyakarta", "Sleman", "Bantul", "Gunung Kidul", "Kulon Progo",
        // Jawa Timur
        "Surabaya", "Malang", "Kota Malang", "Kabupaten Malang", "Sidoarjo", "Gresik",
        "Kediri", "Blitar", "Mojokerto", "Pasuruan", "Probolinggo", "Madiun", "Batu",
        "Jember", "Banyuwangi", "Situbondo", "Bondowoso", "Lumajang", "Tulungagung",
        "Trenggalek", "Nganjuk", "Ponorogo", "Pacitan", "Magetan", "Ngawi", "Bojonegoro",
        "Tuban", "Lamongan", "Bangkalan", "Sampang", "Pamekasan", "Sumenep", "Jombang",
        // Sumatera Utara
        "Medan", "Binjai", "Tebing Tinggi", "Pematangsiantar", "Tanjungbalai", "Sibolga",
        "Padangsidimpuan", "Gunungsitoli", "Deli Serdang", "Langkat", "Karo", "Simalungun",
        "Asahan", "Labuhanbatu", "Nias", "Tapanuli Utara", "Tapanuli Selatan", "Mandailing Natal",
        // Sumatera Barat
        "Padang", "Bukittinggi", "Payakumbuh", "Solok", "Sawahlunto", "Padang Panjang",
        "Pariaman", "Agam", "Tanah Datar", "Pasaman", "Pesisir Selatan", "Sijunjung",
        "Dharmasraya", "Lima Puluh Kota",
        // Riau
        "Pekanbaru", "Dumai", "Kampar", "Bengkalis", "Siak", "Indragiri Hulu", "Indragiri Hilir",
        "Kuantan Singingi", "Rokan Hulu", "Rokan Hilir", "Pelalawan", "Meranti",
        // Kepulauan Riau
        "Batam", "Tanjungpinang", "Bintan", "Karimun", "Lingga", "Natuna", "Anambas",
        // Jambi
        "Jambi", "Sungai Penuh", "Muaro Jambi", "Batanghari", "Tebo", "Bungo",
        "Merangin", "Sarolangun", "Tanjung Jabung Barat", "Tanjung Jabung Timur", "Kerinci",
        // Sumatera Selatan
        "Palembang", "Lubuklinggau", "Pagar Alam", "Prabumulih", "Ogan Komering Ilir",
        "Ogan Komering Ulu", "Muara Enim", "Lahat", "Musi Banyuasin", "Banyuasin",
        "Ogan Ilir", "Empat Lawang", "Musi Rawas",
        // Bengkulu
        "Bengkulu", "Rejang Lebong", "Kepahiang", "Lebong", "Bengkulu Selatan",
        "Bengkulu Utara", "Kaur", "Seluma", "Mukomuko",
        // Lampung
        "Bandar Lampung", "Metro", "Lampung Selatan", "Lampung Tengah", "Lampung Utara",
        "Lampung Barat", "Lampung Timur", "Pesawaran", "Pringsewu", "Tanggamus",
        "Tulang Bawang", "Way Kanan", "Mesuji", "Pesisir Barat",
        // Bangka Belitung
        "Pangkalpinang", "Bangka", "Belitung", "Bangka Barat", "Bangka Selatan",
        "Bangka Tengah", "Belitung Timur",
        // Aceh
        "Banda Aceh", "Lhokseumawe", "Langsa", "Sabang", "Subulussalam",
        "Aceh Besar", "Aceh Utara", "Aceh Timur", "Aceh Selatan", "Aceh Barat",
        "Aceh Tengah", "Bireuen", "Pidie", "Nagan Raya", "Aceh Tamiang",
        // Kalimantan Barat
        "Pontianak", "Singkawang", "Sambas", "Sanggau", "Sintang", "Ketapang",
        "Landak", "Mempawah", "Sekadau", "Melawi", "Kayong Utara", "Kubu Raya",
        // Kalimantan Tengah
        "Palangkaraya", "Kotawaringin Barat", "Kotawaringin Timur", "Kapuas", "Barito Selatan",
        "Barito Utara", "Barito Timur", "Murung Raya", "Pulang Pisau", "Gunung Mas",
        "Katingan", "Seruyan", "Sukamara", "Lamandau",
        // Kalimantan Selatan
        "Banjarmasin", "Banjarbaru", "Banjar", "Barito Kuala", "Tapin", "Hulu Sungai Selatan",
        "Hulu Sungai Tengah", "Hulu Sungai Utara", "Tabalong", "Tanah Bumbu", "Tanah Laut", "Kotabaru",
        // Kalimantan Timur
        "Samarinda", "Balikpapan", "Bontang", "Kutai Kartanegara", "Kutai Barat", "Kutai Timur",
        "Berau", "Penajam Paser Utara", "Paser", "Mahakam Ulu",
        // Kalimantan Utara
        "Tarakan", "Tanjung Selor", "Bulungan", "Malinau", "Nunukan",
        // Sulawesi Utara
        "Manado", "Bitung", "Tomohon", "Kotamobagu", "Minahasa", "Minahasa Utara",
        "Minahasa Selatan", "Minahasa Tenggara", "Bolaang Mongondow", "Sangihe", "Talaud",
        // Sulawesi Tengah
        "Palu", "Donggala", "Parigi Moutong", "Poso", "Toli-Toli", "Banggai",
        "Banggai Kepulauan", "Morowali", "Buol", "Sigi", "Tojo Una-Una",
        // Sulawesi Selatan
        "Makassar", "Parepare", "Palopo", "Maros", "Pangkep", "Barru", "Bone",
        "Soppeng", "Wajo", "Sidrap", "Pinrang", "Enrekang", "Tana Toraja",
        "Toraja Utara", "Luwu", "Luwu Utara", "Luwu Timur", "Gowa", "Takalar",
        "Jeneponto", "Bantaeng", "Bulukumba", "Sinjai", "Selayar",
        // Sulawesi Tenggara
        "Kendari", "Bau-Bau", "Konawe", "Konawe Selatan", "Kolaka", "Kolaka Utara",
        "Bombana", "Wakatobi", "Muna", "Buton", "Buton Utara",
        // Gorontalo
        "Gorontalo", "Gorontalo Utara", "Bone Bolango", "Pohuwato", "Boalemo",
        // Sulawesi Barat
        "Mamuju", "Majene", "Polewali Mandar", "Mamasa", "Pasangkayu", "Mamuju Tengah",
        // Bali
        "Denpasar", "Badung", "Gianyar", "Tabanan", "Klungkung", "Bangli",
        "Karangasem", "Buleleng", "Jembrana",
        // NTB
        "Mataram", "Bima", "Lombok Barat", "Lombok Tengah", "Lombok Timur",
        "Lombok Utara", "Sumbawa", "Sumbawa Barat", "Dompu",
        // NTT
        "Kupang", "Ende", "Flores Timur", "Manggarai", "Manggarai Barat",
        "Nagekeo", "Ngada", "Sikka", "Sumba Barat", "Sumba Timur",
        "Timor Tengah Selatan", "Timor Tengah Utara", "Belu", "Alor", "Lembata",
        "Rote Ndao", "Sabu Raijua", "Malaka",
        // Maluku
        "Ambon", "Tual", "Seram Bagian Barat", "Seram Bagian Timur", "Maluku Tengah",
        "Maluku Tenggara", "Maluku Barat Daya", "Buru", "Kepulauan Aru",
        // Maluku Utara
        "Ternate", "Tidore Kepulauan", "Halmahera Utara", "Halmahera Selatan",
        "Halmahera Barat", "Halmahera Timur", "Halmahera Tengah", "Morotai", "Pulau Taliabu",
        // Papua
        "Jayapura", "Merauke", "Mimika", "Timika", "Nabire", "Biak Numfor",
        "Sarmi", "Keerom", "Yahukimo", "Pegunungan Bintang", "Tolikara",
        "Puncak Jaya", "Paniai", "Deiyai", "Dogiyai", "Intan Jaya", "Nduga",
        "Lanny Jaya", "Mamberamo Raya", "Mamberamo Tengah", "Yalimo", "Waropen",
        "Supiori", "Asmat", "Mappi", "Boven Digoel",
        // Papua Barat
        "Sorong", "Manokwari", "Fakfak", "Kaimana", "Teluk Bintuni", "Teluk Wondama",
        "Raja Ampat", "Tambrauw", "Maybrat",
        // IKN
        "Nusantara (IKN)"
    ];

    let activeIndex = -1;

    function renderDropdown(suggestions, query) {
        locationDropdown.innerHTML = '';
        let hasExactMatch = false;

        suggestions.forEach((sug, index) => {
            if (sug.toLowerCase() === query.toLowerCase()) hasExactMatch = true;
            const li = document.createElement('li');
            li.dataset.value = sug;
            li.innerHTML = `<span>${escapeHTML(sug)}</span>`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSuggestion(sug);
            });
            locationDropdown.appendChild(li);
        });

        if (query && !hasExactMatch) {
            const li = document.createElement('li');
            li.dataset.value = query;
            li.innerHTML = `<span style="font-style: italic; color: var(--primary);">Use "${escapeHTML(query)}"</span>`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSuggestion(query);
            });
            locationDropdown.appendChild(li);
        }

        if (locationDropdown.children.length === 0) {
            locationDropdown.style.display = 'none';
        } else {
            locationDropdown.style.display = 'block';
        }
        activeIndex = -1;
    }

    function selectSuggestion(val) {
        jobLocation.value = val;
        locationDropdown.style.display = 'none';
    }

    jobLocation.addEventListener('input', () => {
        const query = jobLocation.value.trim();
        if (!query) {
            locationDropdown.style.display = 'none';
            return;
        }

        const lowerQuery = query.toLowerCase();

        // Find matching locations
        const matches = LOCATIONS.filter(loc => 
            loc.toLowerCase().includes(lowerQuery)
        ).slice(0, 8);

        renderDropdown(matches, query);
    });

    // Keyboard navigation
    jobLocation.addEventListener('keydown', (e) => {
        const items = locationDropdown.querySelectorAll('li');
        if (locationDropdown.style.display === 'none' || items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < items.length) {
                const selectedVal = items[activeIndex].dataset.value;
                selectSuggestion(selectedVal);
            }
        } else if (e.key === 'Escape') {
            locationDropdown.style.display = 'none';
        }
    });

    function updateActiveItem(items) {
        items.forEach((item, index) => {
            if (index === activeIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!jobLocation.contains(e.target) && !locationDropdown.contains(e.target)) {
            locationDropdown.style.display = 'none';
        }
    });
}

function initPlatformAutocomplete() {
    const jobPlatform = document.getElementById('jobPlatform');
    const platformDropdown = document.getElementById('platformDropdown');

    if (!jobPlatform || !platformDropdown) return;

    const PLATFORMS = [
        "LinkedIn", "Jobstreet", "Glints", "Kalibrr", "Indeed", 
        "Talentics", "Social Media", "Company Website", "Referral", "Other"
    ];

    let activeIndex = -1;

    function renderDropdown(suggestions, query) {
        platformDropdown.innerHTML = '';
        let hasExactMatch = false;

        suggestions.forEach((sug, index) => {
            if (sug.toLowerCase() === query.toLowerCase()) hasExactMatch = true;
            const li = document.createElement('li');
            li.dataset.value = sug;
            li.innerHTML = `<span>${escapeHTML(sug)}</span>`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSuggestion(sug);
            });
            platformDropdown.appendChild(li);
        });

        if (query && !hasExactMatch) {
            const li = document.createElement('li');
            li.dataset.value = query;
            li.innerHTML = `<span style="font-style: italic; color: var(--primary);">Use "${escapeHTML(query)}"</span>`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSuggestion(query);
            });
            platformDropdown.appendChild(li);
        }

        if (platformDropdown.children.length === 0) {
            platformDropdown.style.display = 'none';
        } else {
            platformDropdown.style.display = 'block';
        }
        activeIndex = -1;
    }

    function selectSuggestion(val) {
        jobPlatform.value = val;
        platformDropdown.style.display = 'none';
    }

    jobPlatform.addEventListener('input', () => {
        const query = jobPlatform.value.trim();
        if (!query) {
            platformDropdown.style.display = 'none';
            return;
        }

        const lowerQuery = query.toLowerCase();

        // Find matching platforms
        const matches = PLATFORMS.filter(plat => 
            plat.toLowerCase().includes(lowerQuery)
        ).slice(0, 8);

        renderDropdown(matches, query);
    });

    // Keyboard navigation
    jobPlatform.addEventListener('keydown', (e) => {
        const items = platformDropdown.querySelectorAll('li');
        if (platformDropdown.style.display === 'none' || items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < items.length) {
                const selectedVal = items[activeIndex].dataset.value;
                selectSuggestion(selectedVal);
            }
        } else if (e.key === 'Escape') {
            platformDropdown.style.display = 'none';
        }
    });

    function updateActiveItem(items) {
        items.forEach((item, index) => {
            if (index === activeIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!jobPlatform.contains(e.target) && !platformDropdown.contains(e.target)) {
            platformDropdown.style.display = 'none';
        }
    });
}

// ==========================================
// NEW FEATURES: Dashboard, Analytics, Pipeline, CSV

window.updateDashboardCards = function() {
    const dashTotal = document.getElementById('dashTotal');
    const dashInProgress = document.getElementById('dashInProgress');
    const dashInterview = document.getElementById('dashInterview');
    const dashOffer = document.getElementById('dashOffer');
    const dashAttention = document.getElementById('dashAttention');
    const dashHitRate = document.getElementById('dashHitRate');
    const dashPulseInsight = document.getElementById('dashPulseInsight');
    const dashFocusTitle = document.getElementById('dashFocusTitle');
    const dashFocusMeta = document.getElementById('dashFocusMeta');

    if (!dashTotal) return;

    let total = jobs.length;
    let inProgress = 0;
    let interview = 0;
    let offer = 0;
    let attention = 0;
    const focusItems = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    jobs.forEach(j => {
        if (['applied', 'psychotest'].includes(j.status)) inProgress++;
        else if (['interview-hr', 'interview-user', 'mcu'].includes(j.status)) interview++;
        else if (['offering', 'accepted'].includes(j.status)) offer++;
        const followUpDate = parseValidDate(j.followUp);
        const deadlineDate = parseValidDate(j.deadline);
        let needsAttention = j.status === 'ghosted';

        if (followUpDate) {
            focusItems.push({ job: j, date: followUpDate, type: 'Follow up' });
            if (followUpDate <= today) needsAttention = true;
        }

        if (deadlineDate) {
            focusItems.push({ job: j, date: deadlineDate, type: 'Deadline' });
            if (deadlineDate <= today) needsAttention = true;
        }

        if (needsAttention) attention++;
        // 'withdrawn' is intentionally not counted in any sub-category — it's user-initiated, not a rejection
    });

    dashTotal.textContent = total;
    dashInProgress.textContent = inProgress;
    dashInterview.textContent = interview;
    dashOffer.textContent = offer;
    if (dashAttention) dashAttention.textContent = attention;

    // Hit Rate = (interview + offer) / total * 100
    let hitRate = '';
    if (dashHitRate) {
        if (total > 0) {
            hitRate = (((interview + offer) / total) * 100).toFixed(1);
            dashHitRate.textContent = `${hitRate}% to interview`;
        } else {
            dashHitRate.textContent = '';
        }
    }

    if (dashPulseInsight) {
        dashPulseInsight.textContent = total > 0
            ? `${inProgress} active | ${hitRate || '0.0'}% to interview`
            : 'Start tracking your first application.';
    }

    if (dashFocusTitle && dashFocusMeta) {
        focusItems.sort((a, b) => a.date - b.date);
        const nextFocus = focusItems[0];

        if (nextFocus) {
            const diffDays = Math.round((nextFocus.date - today) / (1000 * 60 * 60 * 24));
            let whenText = nextFocus.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (diffDays < 0) whenText = `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} late`;
            else if (diffDays === 0) whenText = 'Today';
            else if (diffDays === 1) whenText = 'Tomorrow';

            const focusType = nextFocus.type === 'Deadline' ? 'Deadline' : 'Follow-up';
            dashFocusTitle.textContent = `${focusType}: ${nextFocus.job.company || 'Unknown company'}`;
            dashFocusMeta.textContent = whenText;
        } else if (inProgress > 0) {
            dashFocusTitle.textContent = 'Check active applications';
            dashFocusMeta.textContent = `${inProgress} application${inProgress > 1 ? 's' : ''} still active.`;
        } else {
            dashFocusTitle.textContent = 'No follow-up yet';
            dashFocusMeta.textContent = 'Add a follow-up date when needed.';
        }
    }
};

let statusChartInstance = null;
let activityChartInstance = null;

window.renderAnalytics = function(filteredJobs) {
    renderStatusChart(filteredJobs);
    renderActivityChart(filteredJobs);
};

function renderStatusChart(filteredJobs) {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Aggregate by status — ordered by pipeline stage for logical reading
    const statusOrder = ['applied', 'psychotest', 'interview-hr', 'interview-user', 'mcu', 'offering', 'accepted', 'rejected', 'ghosted', 'withdrawn'];
    const statusCounts = {};
    filteredJobs.forEach(job => {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    // Filter to only statuses that exist, in pipeline order
    const activeStatuses = statusOrder.filter(s => statusCounts[s] > 0);
    const totalForPercent = filteredJobs.length;

    const labels = activeStatuses.map(k => CONSTANTS.STATUS_MAP[k]?.label || k);
    const data = activeStatuses.map(k => statusCounts[k]);

    const sagePalette = {
        'applied': '#8B9E8A',
        'psychotest': '#B9AACF',
        'interview-hr': '#D9C4B4',
        'interview-user': '#C7B3A4',
        'mcu': '#AAB09D',
        'offering': '#75906F',
        'accepted': '#59745D',
        'rejected': '#E6B0B8',
        'ghosted': '#B7AAA2',
        'withdrawn': '#CFC7BA'
    };

    const backgroundColors = activeStatuses.map(s => sagePalette[s] || '#8B9E8A');

    const placeholder = document.getElementById('analyticsPlaceholder');
    if (data.length === 0) {
        if (placeholder) placeholder.style.display = 'block';
        canvas.style.display = 'none';
        if (statusChartInstance) { statusChartInstance.destroy(); statusChartInstance = null; }
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    canvas.style.display = 'block';

    if (statusChartInstance) { statusChartInstance.destroy(); }

    if (typeof Chart !== 'undefined') {
        const isDark = document.body.classList.contains('dark-theme');
        statusChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 32,
                    barPercentage: 0.7
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1E2B23' : '#2F3E36',
                        titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
                        bodyFont: { family: 'Plus Jakarta Sans', weight: 500 },
                        cornerRadius: 8,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.x;
                                const pct = totalForPercent > 0 ? ((val / totalForPercent) * 100).toFixed(1) : 0;
                                return `${val} job${val > 1 ? 's' : ''} (${pct}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: isDark ? '#9BB0A5' : '#6D7D72',
                            font: { family: 'Plus Jakarta Sans', size: 11, weight: 500 },
                            padding: 4,
                            maxRotation: 0,
                            minRotation: 0
                        },
                        grid: {
                            color: isDark ? 'rgba(155, 176, 165, 0.1)' : 'rgba(185, 170, 207, 0.16)',
                            drawBorder: false
                        },
                        border: { display: false }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: isDark ? '#E2EAE5' : '#23342E',
                            font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
                            padding: 8
                        },
                        border: { display: false }
                    }
                }
            }
        });
    }
}

function renderActivityChart(filteredJobs) {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('activityPlaceholder');

    if (filteredJobs.length === 0) {
        if (placeholder) placeholder.style.display = 'block';
        canvas.style.display = 'none';
        if (activityChartInstance) { activityChartInstance.destroy(); activityChartInstance = null; }
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    canvas.style.display = 'block';

    // Decide grouping: if date range <= 14 days, group by day; otherwise by week
    const dateBuckets = {};
    filteredJobs.forEach(job => {
        if (!job.date) return;
        const d = new Date(job.date);
        if (isNaN(d.getTime())) return;
        const key = d.toISOString().split('T')[0];
        dateBuckets[key] = (dateBuckets[key] || 0) + 1;
    });

    const allDates = Object.keys(dateBuckets).sort();
    if (allDates.length === 0) {
        if (placeholder) placeholder.style.display = 'block';
        canvas.style.display = 'none';
        return;
    }

    const minDate = new Date(allDates[0]);
    const maxDate = new Date(allDates[allDates.length - 1]);
    const rangeDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

    let labels, data;

    if (rangeDays <= 21) {
        // Group by individual date — fill gaps for continuous timeline
        labels = [];
        data = [];
        const cur = new Date(minDate);
        while (cur <= maxDate) {
            const key = cur.toISOString().split('T')[0];
            labels.push(cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(dateBuckets[key] || 0);
            cur.setDate(cur.getDate() + 1);
        }
    } else {
        // Group by week (Mon-Sun)
        const weekBuckets = {};
        filteredJobs.forEach(job => {
            if (!job.date) return;
            const d = new Date(job.date);
            if (isNaN(d.getTime())) return;
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d);
            monday.setDate(diff);
            const key = monday.toISOString().split('T')[0];
            weekBuckets[key] = (weekBuckets[key] || 0) + 1;
        });

        const sortedKeys = Object.keys(weekBuckets).sort();
        labels = sortedKeys.map(key => {
            const d = new Date(key);
            const endOfWeek = new Date(d);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            const fmt = (dt) => `${dt.getDate()} ${dt.toLocaleDateString('en-US', { month: 'short' })}`;
            return `${fmt(d)} - ${fmt(endOfWeek)}`;
        });
        data = sortedKeys.map(k => weekBuckets[k]);
    }

    if (activityChartInstance) { activityChartInstance.destroy(); }

    if (typeof Chart !== 'undefined') {
        const isDark = document.body.classList.contains('dark-theme');
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (isDark) {
            gradient.addColorStop(0, 'rgba(185, 170, 207, 0.7)');
            gradient.addColorStop(0.55, 'rgba(155, 194, 172, 0.42)');
            gradient.addColorStop(1, 'rgba(198, 142, 152, 0.14)');
        } else {
            gradient.addColorStop(0, 'rgba(185, 170, 207, 0.7)');
            gradient.addColorStop(0.55, 'rgba(139, 158, 138, 0.42)');
            gradient.addColorStop(1, 'rgba(230, 176, 184, 0.2)');
        }

        activityChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Applications',
                    data: data,
                    backgroundColor: gradient,
                    borderColor: isDark ? '#B9AACF' : '#8B9E8A',
                    borderWidth: 1.5,
                    borderRadius: 5,
                    borderSkipped: false,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1E2B23' : '#2F3E36',
                        titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
                        bodyFont: { family: 'Plus Jakarta Sans', weight: 500 },
                        cornerRadius: 8,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} application${context.parsed.y > 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: isDark ? '#9BB0A5' : '#6D7D72',
                            font: { family: 'Plus Jakarta Sans', size: 10, weight: 500 },
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: isDark ? '#9BB0A5' : '#6D7D72',
                            font: { family: 'Plus Jakarta Sans', size: 11, weight: 500 },
                            padding: 8
                        },
                        grid: {
                            color: isDark ? 'rgba(155, 176, 165, 0.1)' : 'rgba(217, 196, 180, 0.18)',
                            drawBorder: false
                        },
                        border: { display: false }
                    }
                }
            }
        });
    }
}

window.updateVisualPipeline = function(status) {
    const pipelineSteps = document.querySelectorAll('.pipeline-step');
    const pipelineLines = document.querySelectorAll('.pipeline-line');
    
    const stepSequence = ['applied', 'psychotest', 'interview-hr', 'interview-user', 'mcu', 'offering'];
    const currentIndex = stepSequence.indexOf(status);
    
    pipelineSteps.forEach((step, index) => {
        const stepName = step.dataset.step;
        const stepIndex = stepSequence.indexOf(stepName);
        
        step.classList.remove('active', 'completed');
        
        if (currentIndex === -1) {
             if (status === 'accepted') step.classList.add('completed');
        } else {
            if (stepIndex < currentIndex) {
                step.classList.add('completed');
            } else if (stepIndex === currentIndex) {
                step.classList.add('active');
            }
        }
    });

    pipelineLines.forEach((line, index) => {
        line.classList.remove('completed');
        if (currentIndex === -1 && status === 'accepted') {
             line.classList.add('completed');
        } else if (currentIndex > -1 && index < currentIndex) {
            line.classList.add('completed');
        }
    });
};
