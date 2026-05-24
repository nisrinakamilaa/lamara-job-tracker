// We load data from Local Storage or start empty.
function loadFromLocalStorage() {
    const saved = localStorage.getItem('lamaraJobs');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing Local Storage', e);
            return [];
        }
    }
    return [];
}

function saveToLocalStorage() {
    if (currentUser) {
        return; // Don't cache cloud data to local storage, leave the offline data alone
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

    const { data, error } = await supabaseClient
        .from('jobs')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Failed to load Supabase jobs:', error);
        jobs = loadFromLocalStorage();
        isInitialLoad = false;
        renderList();
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
                // Safely clear the offline data since it's now in the cloud
                localStorage.removeItem('lamaraJobs');
            } catch (err) {
                console.error('Failed to migrate local jobs to Supabase:', err);
                alert('Error saving to cloud: ' + (err.message || err.error_description || 'Unknown error. Did you run the SQL schema?'));
            }
        }
    }

    isInitialLoad = false;
    renderList();
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
