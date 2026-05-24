function setupEventListeners() {
    if (accountBtn && accountMenu) {
        accountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accountMenu.hidden = !accountMenu.hidden;
        });
        accountMenu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            accountMenu.hidden = true;
        });
    }
    if (loginBtn) loginBtn.addEventListener('click', async () => {
        if (accountMenu) accountMenu.hidden = true;
        openAuthModal();
    });
    if (setPasswordBtn) setPasswordBtn.addEventListener('click', () => {
        if (accountMenu) accountMenu.hidden = true;
        openAuthModal('updatePassword');
    });
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        const originalText = logoutBtn.innerHTML;
        logoutBtn.innerHTML = '<i data-lucide="loader" class="spinner"></i> Signing out...';
        logoutBtn.disabled = true;
        logoutBtn.style.opacity = '0.7';
        lucide.createIcons();
        
        // Artificial delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await signOut();
        
        if (accountMenu) accountMenu.hidden = true;
        logoutBtn.innerHTML = originalText;
        logoutBtn.disabled = false;
        logoutBtn.style.opacity = '1';
        lucide.createIcons();
    });
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', deleteAccount);
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });
    }
    
    // Password visibility toggles
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.setAttribute('data-lucide', 'eye');
            } else {
                input.type = 'password';
                icon.setAttribute('data-lucide', 'eye-off');
            }
            lucide.createIcons();
        });
    });

    if (authForm) authForm.addEventListener('submit', signInWithPassword);
    if (authSignupBtn) authSignupBtn.addEventListener('click', signUpWithPassword);
    if (authResetBtn) authResetBtn.addEventListener('click', sendPasswordReset);

    // Drawer Toggles
    drawerBtn.addEventListener('click', () => {
        currentEditJobId = null;
        removeCvFile = false;
        const cvStatus = document.getElementById('cvFileStatus');
        if (cvStatus) cvStatus.innerHTML = '';
        const cvInput = document.getElementById('jobCvFile');
        if (cvInput) {
            cvInput.style.display = 'block';
            cvInput.value = '';
        }
        document.querySelector('.drawer-header h3').textContent = 'Add New Opportunity';
        const saveBtn = jobForm.querySelector('button[type="submit"]');
        if (saveBtn) saveBtn.textContent = 'Save Job';
        openDrawer();
    });
    closeDrawerBtn.addEventListener('click', closeDrawer);
    cancelBtn.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    // Theme Toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            renderList();
        });
    }

    const jobCvFile = document.getElementById('jobCvFile');
    if (jobCvFile) {
        jobCvFile.addEventListener('change', (e) => {
            removeCvFile = false;
            const cvStatus = document.getElementById('cvFileStatus');
            if (cvStatus && e.target.files.length > 0) {
                cvStatus.innerHTML = `<span style="color: var(--text-muted);"><i data-lucide="upload" style="width: 14px; height: 14px; vertical-align: middle;"></i> New CV selected</span>`;
                lucide.createIcons();
            } else if (cvStatus) {
                cvStatus.innerHTML = '';
            }
        });
    }

    // Form Submit
    jobForm.addEventListener('submit', handleFormSubmit);

    // Custom Dropdown Logic
    dropdownHeader.addEventListener('click', () => {
        statusDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!statusDropdown.contains(e.target)) {
            statusDropdown.classList.remove('open');
        }
    });

    // Handle dropdown selection
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Update active state
            dropdownItems.forEach(li => li.classList.remove('selected'));
            e.target.classList.add('selected');
            
            // Update text
            dropdownSelected.textContent = e.target.textContent;
            
            // Apply filter
            currentFilter = e.target.dataset.value;
            statusDropdown.classList.remove('open');
            currentPage = 1;
            renderList();
        });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1;
        renderList();
    });

    // Form Custom Dropdown Logic
    const formStatusDropdown = document.getElementById('formStatusDropdown');
    const formDropdownHeader = document.getElementById('formDropdownHeader');
    const formDropdownList = document.getElementById('formDropdownList');
    const formDropdownSelected = document.getElementById('formDropdownSelected');
    const formDropdownItems = formDropdownList.querySelectorAll('li');
    const jobStatusInput = document.getElementById('jobStatus');

    formDropdownHeader.addEventListener('click', () => {
        formStatusDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!formStatusDropdown.contains(e.target)) {
            formStatusDropdown.classList.remove('open');
        }
    });

    formDropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Update active state
            formDropdownItems.forEach(li => li.classList.remove('selected'));
            e.target.classList.add('selected');
            
            // Update text and hidden input
            formDropdownSelected.textContent = e.target.textContent;
            jobStatusInput.value = e.target.dataset.value;
            
            formStatusDropdown.classList.remove('open');

            // Update Visual Pipeline when status changes
            if (window.updateVisualPipeline) {
                window.updateVisualPipeline(e.target.dataset.value);
            }
        });
    });

    // Form Custom Dropdown Logic (Priority)
    const priorityDropdown = document.getElementById('priorityDropdown');
    const priorityDropdownHeader = document.getElementById('priorityDropdownHeader');
    const priorityDropdownList = document.getElementById('priorityDropdownList');
    const priorityDropdownSelected = document.getElementById('priorityDropdownSelected');
    const priorityDropdownItems = priorityDropdownList ? priorityDropdownList.querySelectorAll('li') : [];
    const jobPriorityInput = document.getElementById('jobPriority');

    if (priorityDropdownHeader) {
        priorityDropdownHeader.addEventListener('click', () => {
            priorityDropdown.classList.toggle('open');
        });
    }

    document.addEventListener('click', (e) => {
        if (priorityDropdown && !priorityDropdown.contains(e.target)) {
            priorityDropdown.classList.remove('open');
        }
    });

    priorityDropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            priorityDropdownItems.forEach(li => li.classList.remove('selected'));
            e.target.classList.add('selected');
            if (priorityDropdownSelected) priorityDropdownSelected.textContent = e.target.textContent;
            if (jobPriorityInput) jobPriorityInput.value = e.target.dataset.value;
            priorityDropdown.classList.remove('open');
        });
    });

    // CSV Listeners
    const exportBtn = document.getElementById('exportBtn');
    const exportModal = document.getElementById('exportModal');
    if (exportBtn && exportModal) {
        exportBtn.addEventListener('click', () => {
            exportModal.classList.add('active');
        });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportModal.classList.remove('active');
            if (window.exportToCSV) window.exportToCSV();
        });
    }

    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportModal.classList.remove('active');
            if (window.exportToExcel) window.exportToExcel();
        });
    }

    const importBtn = document.getElementById('importBtn');
    const importCsvInput = document.getElementById('importCsvInput');
    if (importBtn && importCsvInput) {
        importBtn.addEventListener('click', () => importCsvInput.click());
        importCsvInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                if (file.name.endsWith('.xlsx')) {
                    if (window.importFromExcel) window.importFromExcel(file);
                } else {
                    if (window.importFromCSV) window.importFromCSV(file);
                }
                importCsvInput.value = ''; // reset
            }
        });
    }

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (jobs.length === 0) {
                alert("Your application list is already empty.");
                return;
            }
            if (confirm("Are you sure you want to delete all applications? This action cannot be undone.")) {
                jobs = [];
                saveToLocalStorage();
                if (remoteReady && supabaseClient) {
                    supabaseClient.from('jobs').delete().eq('user_id', currentUser.id)
                        .then(({ error }) => {
                            if (error) alert(error.message);
                        });
                }
                renderList();
            }
        });
    }

    // Auto-detect platform from URL
    const jobUrlInput = document.getElementById('jobUrl');
    const jobPlatformInput = document.getElementById('jobPlatform');
    if (jobUrlInput && jobPlatformInput) {
        jobUrlInput.addEventListener('input', (e) => {
            const url = e.target.value.toLowerCase();
            if (!url) return;
            
            let detectedPlatform = '';
            if (url.includes('linkedin.com')) {
                detectedPlatform = 'LinkedIn';
            } else if (url.includes('jobstreet.')) {
                detectedPlatform = 'Jobstreet';
            } else if (url.includes('glints.')) {
                detectedPlatform = 'Glints';
            } else if (url.includes('kalibrr.')) {
                detectedPlatform = 'Kalibrr';
            } else if (url.includes('indeed.')) {
                detectedPlatform = 'Indeed';
            } else if (url.includes('talentics.')) {
                detectedPlatform = 'Talentics';
            }
            
            if (detectedPlatform) {
                jobPlatformInput.value = detectedPlatform;
            }
        });
    }

    // Set default date to today using custom date picker
    initCustomDatePicker();

    // Initialize location autocomplete
    initLocationAutocomplete();

    // Initialize platform autocomplete
    initPlatformAutocomplete();
}


document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    lucide.createIcons();

    await initAuth();
    
    // Render initial state
    renderList();

    // Event Listeners
    setupEventListeners();
});
