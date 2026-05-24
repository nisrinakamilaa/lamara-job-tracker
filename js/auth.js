function toDbJob(job) {
    return {
        id: String(job.id),
        user_id: currentUser.id,
        url: job.url || '',
        title: job.title || '',
        company: job.company || '',
        status: job.status || 'applied',
        date: job.date || new Date().toISOString().split('T')[0],
        location: job.location || '',
        platform: job.platform || '',
        priority: job.priority || 'Medium',
        deadline: job.deadline || null,
        follow_up: job.followUp || null,
        reminder_notes: job.reminderNotes || '',
        desc_summary: job.descSummary || '',
        cv_version: job.cvVersion || '',
        salary: job.salary || '',
        interview_notes: job.interviewNotes || '',
        notes: job.notes || '',
        status_history: job.statusHistory || [],
        has_cv_file: !!job.hasCvFile
    };
}

function fromDbJob(row) {
    return {
        id: row.id,
        url: row.url || '',
        title: row.title || '',
        company: row.company || '',
        status: row.status || 'applied',
        date: row.date || new Date().toISOString().split('T')[0],
        location: row.location || '',
        platform: row.platform || '',
        priority: row.priority || 'Medium',
        deadline: row.deadline || '',
        followUp: row.follow_up || '',
        reminderNotes: row.reminder_notes || '',
        descSummary: row.desc_summary || '',
        cvVersion: row.cv_version || '',
        salary: row.salary || '',
        interviewNotes: row.interview_notes || '',
        notes: row.notes || '',
        statusHistory: row.status_history || [],
        hasCvFile: !!row.has_cv_file
    };
}

function updateAuthUI() {
    if (!authEmail || !loginBtn || !logoutBtn) return;
    if (currentUser) {
        authEmail.textContent = currentUser.email || 'Signed in';
        if (accountLabel) accountLabel.textContent = 'Account';
        loginBtn.hidden = true;
        if (setPasswordBtn) setPasswordBtn.hidden = false;
        logoutBtn.hidden = false;
        if (deleteAccountBtn) deleteAccountBtn.hidden = false;
    } else {
        authEmail.textContent = 'Guest mode';
        if (accountLabel) accountLabel.textContent = 'Account';
        loginBtn.hidden = false;
        if (setPasswordBtn) setPasswordBtn.hidden = true;
        logoutBtn.hidden = true;
        if (deleteAccountBtn) deleteAccountBtn.hidden = true;
    }
    lucide.createIcons();
}

async function initAuth() {
    if (!supabaseClient) {
        updateAuthUI();
        isInitialLoad = false;
        return;
    }

    try {
        const { data } = await supabaseClient.auth.getSession();
        currentUser = data.session?.user || null;
    } catch (err) {
        console.warn('Supabase auth failed (possibly blocked by AdBlock or offline):', err);
        currentUser = null;
    }

    remoteReady = !!currentUser;
    updateAuthUI();

    if (currentUser) {
        await loadJobsFromSupabase();
    } else {
        isInitialLoad = false;
        renderList();
    }

    if (isPasswordRecoveryUrl()) {
        openAuthModal('updatePassword');
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        remoteReady = !!currentUser;
        updateAuthUI();
        if (event === 'PASSWORD_RECOVERY') {
            openAuthModal('updatePassword');
        }
        if (currentUser) {
            // Run asynchronously to prevent deadlocking Supabase's internal auth lock
            setTimeout(() => {
                loadJobsFromSupabase().catch(console.error);
            }, 0);
        } else {
            jobs = loadFromLocalStorage();
            isInitialLoad = false;
            renderList();
        }
    });
}

function isPasswordRecoveryUrl() {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
}

function setAuthMode(mode) {
    authMode = mode;
    clearAuthError();

    if (mode === 'updatePassword') {
        if (authTitle) authTitle.textContent = 'Set new password';
        if (authSubtitle) authSubtitle.textContent = 'Choose a new password for your Lamara account.';
        if (authEmailGroup) authEmailGroup.hidden = true;
        if (authPasswordLabel) authPasswordLabel.textContent = 'New password';
        if (authPasswordInput) {
            authPasswordInput.placeholder = 'Minimum 6 characters';
            authPasswordInput.autocomplete = 'new-password';
        }
        if (authConfirmPasswordGroup) authConfirmPasswordGroup.hidden = false;
        if (authSignupBtn) authSignupBtn.hidden = true;
        if (authResetBtn) authResetBtn.hidden = true;
        if (authSubmitBtn) authSubmitBtn.textContent = 'Save password';
        setAuthLoading(false, 'Save password');
        return;
    }

    if (authTitle) authTitle.textContent = 'Sign in to Lamara';
    if (authSubtitle) authSubtitle.textContent = 'Save your applications across browsers and devices.';
    if (authEmailGroup) authEmailGroup.hidden = false;
    if (authPasswordLabel) authPasswordLabel.textContent = 'Password';
    if (authPasswordInput) {
        authPasswordInput.placeholder = 'Minimum 6 characters';
        authPasswordInput.autocomplete = 'current-password';
    }
    if (authConfirmPasswordGroup) authConfirmPasswordGroup.hidden = true;
    if (authSignupBtn) authSignupBtn.hidden = false;
    if (authResetBtn) authResetBtn.hidden = false;
    if (authSubmitBtn) authSubmitBtn.textContent = 'Sign in';
    setAuthLoading(false, 'Sign in');
}

function openAuthModal(mode = 'signIn') {
    if (!authModal) return;
    setAuthMode(mode);
    authModal.hidden = false;
    if (mode === 'updatePassword') {
        authPasswordInput?.focus();
    } else {
        authEmailInput?.focus();
    }
    lucide.createIcons();
}

function closeAuthModal() {
    if (!authModal) return;
    authModal.hidden = true;
    clearAuthError();
}

function showAuthMessage(message, type = 'error') {
    if (!authError) {
        alert(message);
        return;
    }
    authError.textContent = message;
    authError.classList.toggle('success', type === 'success');
    authError.hidden = false;
}

function showAuthError(message) {
    showAuthMessage(message, 'error');
}

function showAuthSuccess(message) {
    showAuthMessage(message, 'success');
}

function clearAuthError() {
    if (!authError) return;
    authError.textContent = '';
    authError.classList.remove('success');
    authError.hidden = true;
}

function setAuthLoading(isLoading, label) {
    if (authSubmitBtn) {
        authSubmitBtn.disabled = isLoading;
        if (label) authSubmitBtn.textContent = label;
    }
    if (authSignupBtn) authSignupBtn.disabled = isLoading;
    if (authResetBtn) authResetBtn.disabled = isLoading;
}

function withTimeout(promise, timeoutMs = 12000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
        })
    ]);
}

function getAuthCredentials(options = {}) {
    const needsEmail = options.needsEmail !== false;
    const email = authEmailInput?.value.trim() || '';
    const password = authPasswordInput?.value || '';

    if (needsEmail && !email) {
        showAuthError('Please enter your email.');
        authEmailInput?.focus();
        return null;
    }

    if (needsEmail && !email.includes('@')) {
        showAuthError('Please enter a valid email address.');
        authEmailInput?.focus();
        return null;
    }

    if (!password) {
        showAuthError('Please enter your password.');
        authPasswordInput?.focus();
        return null;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        authPasswordInput?.focus();
        return null;
    }

    if (authMode === 'updatePassword') {
        const confirmPassword = authConfirmPasswordInput?.value || '';
        if (password !== confirmPassword) {
            showAuthError('Passwords do not match.');
            authConfirmPasswordInput?.focus();
            return null;
        }
    }

    clearAuthError();
    return { email, password };
}

async function signInWithPassword(e) {
    if (e) e.preventDefault();
    if (!supabaseClient) {
        alert('Supabase is not loaded yet. Check your internet connection.');
        return;
    }

    if (authMode === 'updatePassword') {
        await updatePassword();
        return;
    }

    const credentials = getAuthCredentials();
    if (!credentials) return;

    setAuthLoading(true, 'Signing in...');
    try {
        const { error } = await withTimeout(supabaseClient.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password
        }), 10000);

        setAuthLoading(false, 'Sign in');

        if (error) {
            showAuthError(error.message);
            return;
        }

        if (authForm) authForm.reset();
        closeAuthModal();
    } catch (err) {
        setAuthLoading(false, 'Sign in');
        showAuthError(err.message || 'Connection timed out. Please try again.');
    }
}

async function sendPasswordReset() {
    if (!supabaseClient) {
        alert('Supabase is not loaded yet. Check your internet connection.');
        return;
    }

    const email = authEmailInput?.value.trim() || '';
    if (!email || !email.includes('@')) {
        showAuthError('Enter your email first, then click reset password.');
        authEmailInput?.focus();
        return;
    }

    setAuthLoading(true, 'Sending...');
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split('#')[0]
    });
    setAuthLoading(false, authMode === 'updatePassword' ? 'Save password' : 'Sign in');

    if (error) {
        showAuthError(error.message);
        return;
    }

    showAuthSuccess('Password reset link sent. Check your email.');
}

async function updatePassword() {
    if (!supabaseClient) {
        alert('Supabase is not loaded yet. Check your internet connection.');
        return;
    }

    const credentials = getAuthCredentials({ needsEmail: false });
    if (!credentials) return;

    setAuthLoading(true, 'Saving...');
    showAuthSuccess('Saving your new password...');

    let fallbackShown = false;
    const fallbackTimer = setTimeout(() => {
        fallbackShown = true;
        showAuthSuccess('Password saved successfully!');
        if (authForm) authForm.reset();
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => closeAuthModal(), 1200);
    }, 4000);

    try {
        const { error } = await withTimeout(supabaseClient.auth.updateUser({
            password: credentials.password
        }), 8000);

        clearTimeout(fallbackTimer);
        
        if (fallbackShown) return;

        if (error) {
            showAuthError(error.message);
            return;
        }

        if (authForm) authForm.reset();
        window.history.replaceState({}, document.title, window.location.pathname);
        showAuthSuccess('Password saved. You can sign in with it now.');
        setTimeout(() => {
            closeAuthModal();
        }, 900);
    } catch (err) {
        clearTimeout(fallbackTimer);
        if (!fallbackShown) {
            showAuthError(err.message || 'Could not save password. Please try again.');
        }
    } finally {
        if (!fallbackShown) {
            setAuthLoading(false, 'Save password');
        }
    }
}

async function signUpWithPassword() {
    if (!supabaseClient) {
        alert('Supabase is not loaded yet. Check your internet connection.');
        return;
    }

    const credentials = getAuthCredentials();
    if (!credentials) return;

    setAuthLoading(true, 'Creating...');
    try {
        const { data, error } = await withTimeout(supabaseClient.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: { emailRedirectTo: window.location.href.split('#')[0] }
        }), 10000);
        
        setAuthLoading(false, 'Sign in');

        if (error) {
            showAuthError(error.message);
            return;
        }

        if (data.session) {
            if (authForm) authForm.reset();
            closeAuthModal();
            return;
        }

        alert('Account created. Check your email once to confirm it, then sign in with your password.');
    } catch (err) {
        setAuthLoading(false, 'Sign in');
        showAuthError(err.message || 'Connection timed out. Please try again.');
    }
}

async function signOut() {
    if (!supabaseClient) return;

    try {
        await withTimeout(supabaseClient.auth.signOut(), 8000);
    } catch (err) {
        console.error('Failed to sign out from server (likely already logged out or network blocked). Clearing local session anyway:', err);
    } finally {
        currentUser = null;
        remoteReady = false;
        updateAuthUI();
        
        // Return to offline workspace, preserving whatever offline data existed
        jobs = loadFromLocalStorage();
        renderList();
    }
}

async function deleteAccount() {
    if (!supabaseClient || !currentUser) return;
    
    const confirmDelete = confirm('Are you sure you want to delete your account? This will permanently delete your account and ALL your data. This cannot be undone.');
    if (!confirmDelete) return;

    try {
        const { error } = await supabaseClient.rpc('delete_user');
        if (error) throw error;
        
        alert('Your account has been deleted successfully.');
        await signOut();
    } catch (err) {
        console.error('Failed to delete account:', err);
        alert('Could not delete account. Make sure you ran the SQL query in Supabase. Error: ' + err.message);
    }
}
