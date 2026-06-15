// We load data from Local Storage or start empty.
const CLOUD_JOBS_CACHE_PREFIX = 'lamaraCloudJobs:';
let cloudJobsLoadPromise = null;
let cloudJobsLoadUserId = null;

function normalizeStatus(status) {
    return status === 'psychotest' ? 'assessment' : (status || 'applied');
}

function normalizeAssessmentType(value, originalStatus = '') {
    if (value) return String(value);
    return originalStatus === 'psychotest' ? 'Psychometric Test' : '';
}

function normalizeJobData(job) {
    if (!job || typeof job !== 'object') return job;

    const originalStatus = job.status || 'applied';
    const normalizedStatus = normalizeStatus(originalStatus);
    const assessmentType = normalizeAssessmentType(job.assessmentType, originalStatus);
    const statusHistory = Array.isArray(job.statusHistory)
        ? job.statusHistory.map(item => {
            if (!item || typeof item !== 'object') return item;
            const itemOriginalStatus = item.status || 'applied';
            return {
                ...item,
                status: normalizeStatus(itemOriginalStatus),
                assessmentType: normalizeAssessmentType(
                    item.assessmentType || (normalizeStatus(itemOriginalStatus) === normalizedStatus ? assessmentType : ''),
                    itemOriginalStatus
                )
            };
        })
        : [];

    return {
        ...job,
        status: normalizedStatus,
        assessmentType,
        statusHistory
    };
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('lamaraJobs');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed.map(normalizeJobData) : [];
        } catch (e) {
            console.error('Error parsing Local Storage', e);
            return [];
        }
    }
    return [];
}

function getCloudJobsCacheKey(userId = currentUser?.id) {
    return userId ? `${CLOUD_JOBS_CACHE_PREFIX}${userId}` : '';
}

function loadCloudJobsCache(userId = currentUser?.id) {
    const cacheKey = getCloudJobsCacheKey(userId);
    if (!cacheKey) return [];

    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        return Array.isArray(cached) ? cached.map(normalizeJobData) : [];
    } catch (error) {
        console.warn('Could not read the cloud jobs cache:', error);
        return [];
    }
}

function saveCloudJobsCache(userId = currentUser?.id) {
    const cacheKey = getCloudJobsCacheKey(userId);
    if (!cacheKey) return;

    try {
        localStorage.setItem(cacheKey, JSON.stringify(jobs));
    } catch (error) {
        console.warn('Could not update the cloud jobs cache:', error);
    }
}

function saveToLocalStorage() {
    if (currentUser) {
        saveCloudJobsCache();
        return;
    }
    localStorage.setItem('lamaraJobs', JSON.stringify(jobs));
}

// IndexedDB Helper for Storing CV Files
const CVStore = {
    dbName: 'LamaraCVsDB',
    dbVersion: 1,
    storeName: 'cvs',

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'jobId' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async save(jobId, fileName, fileType, fileData) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put({ jobId, fileName, fileType, fileData });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async get(jobId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(jobId);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(jobId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(jobId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

async function loadJobsFromSupabase() {
    if (!supabaseClient || !currentUser) return;

    const userId = currentUser.id;
    if (cloudJobsLoadPromise && cloudJobsLoadUserId === userId) {
        return cloudJobsLoadPromise;
    }

    const cachedJobs = loadCloudJobsCache(userId);
    if (cachedJobs.length > 0) {
        jobs = cachedJobs;
        isInitialLoad = false;
        renderList();
    }

    cloudJobsLoadUserId = userId;
    cloudJobsLoadPromise = (async () => {
        const { data, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Failed to load Supabase jobs:', error);
            if (cachedJobs.length === 0) {
                jobs = loadFromLocalStorage();
                isInitialLoad = false;
                renderList();
            }
            return;
        }

        const localJobs = loadFromLocalStorage();
        jobs = (data || []).map(fromDbJob);

        if (jobs.length === 0 && localJobs.length > 0) {
            const shouldImport = confirm('Move your local applications to this account?');
            if (shouldImport) {
                jobs = localJobs;
                try {
                    await saveAllJobsToSupabase();
                    alert('Success! Your local jobs have been saved to your account.');
                    localStorage.removeItem('lamaraJobs');
                } catch (err) {
                    console.error('Failed to migrate local jobs to Supabase:', err);
                    alert('Error saving to cloud: ' + (err.message || err.error_description || 'Unknown error. Did you run the SQL schema?'));
                }
            }
        }

        saveCloudJobsCache(userId);
        isInitialLoad = false;
        renderList();
    })();

    try {
        await cloudJobsLoadPromise;
    } finally {
        if (cloudJobsLoadUserId === userId) {
            cloudJobsLoadPromise = null;
            cloudJobsLoadUserId = null;
        }
    }
}

async function saveJobToSupabase(job) {
    if (!supabaseClient || !currentUser) return;
    const { error } = await supabaseClient.from('jobs').upsert(toDbJob(job));
    if (error) throw error;
}

async function saveAllJobsToSupabase() {
    if (!supabaseClient || !currentUser || jobs.length === 0) return;
    const { error } = await supabaseClient.from('jobs').upsert(jobs.map(toDbJob));
    if (error) throw error;
}
