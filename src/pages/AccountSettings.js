import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import Loader from '../components/Loader';
import Button from '../components/Button';
import { useToast } from '../components/utils/ToastContext';
import { useAuth } from '../components/AuthContext';
import Avatar from '../components/Avatar';
import ImageCropper from '../components/utils/ImageCropper';
import { upload } from '@vercel/blob/client';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function AccountSettings() {
    const { showToast } = useToast();
    const { setUser, bumpImageVersion } = useAuth();

    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        username: '',
        email: '',
        displayName: '',
        avatarUrl: null,
        avatarStorageKey: null,
    });

    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [removingAvatar, setRemovingAvatar] = useState(false);
    const [error, setError] = useState('');

    const [cropImageSrc, setCropImageSrc] = useState('');
    const [cropperOpen, setCropperOpen] = useState(false);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const closeCropper = () => {
        if (cropImageSrc?.startsWith('blob:')) {
            URL.revokeObjectURL(cropImageSrc);
        }
        setCropImageSrc('');
        setCropperOpen(false);
    };

    const refreshUserAfterAvatarUpload = async (expectedPathname) => {
        for (let i = 0; i < 6; i += 1) {
            const { data } = await api.get('/users/me', {
                withCredentials: true,
                params: { _: Date.now() + i },
                headers: { 'Cache-Control': 'no-cache' },
            });

            if (!expectedPathname || data.avatarStorageKey === expectedPathname) {
                applyUserData(data);
                return true;
            }

            await sleep(350);
        }

        return false;
    };

    const uploadAvatarFile = async (file) => {
        setUploadingAvatar(true);
        setError('');

        try {
            const blob = await upload('avatars/avatar.webp', file, {
                access: 'public',
                handleUploadUrl: '/api/users/me/avatar',
            });

            const { data } = await api.patch(
                '/users/me/avatar',
                {
                    avatarUrl: blob.url,
                    avatarStorageKey: blob.pathname,
                },
                { withCredentials: true }
            );

            applyUserData(data.user);
            showToast('Avatar updated', { type: 'success' });
        } catch (e) {
            const msg = e.response?.data?.error || e.message || 'Failed to upload avatar';
            setError(msg);
            showToast(msg, { type: 'error' });
            throw e;
        } finally {
            setUploadingAvatar(false);
        }
    };

    const applyUserData = (data) => {
        setInitialData(data);
        setForm({
            username: data.username || '',
            email: data.email || '',
            displayName: data.displayName || '',
            avatarUrl: data.avatarUrl || null,
            avatarStorageKey: data.avatarStorageKey || null,
        });

        setUser((prev) => {
            if (!prev) return data;
            return {
                ...prev,
                username: data.username,
                email: data.email,
                displayName: data.displayName,
                avatarUrl: data.avatarUrl,
                avatarStorageKey: data.avatarStorageKey,
                avatarUpdatedAt: data.avatarUpdatedAt,
            };
        });

        bumpImageVersion?.();
    };

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                setLoading(true);
                setError('');

                const { data } = await api.get('/users/me', { withCredentials: true });

                if (ignore) return;
                applyUserData(data);
            } catch (e) {
                if (!ignore) {
                    setError(e.response?.data?.error || e.message || 'Failed to load account settings');
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, []);

    const isDirty = useMemo(() => {
        if (!initialData) return false;

        return (
            form.username !== (initialData.username || '') ||
            form.displayName !== (initialData.displayName || '')
        );
    }, [form, initialData]);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({
            ...f,
            [name]: value,
        }));
    };

    const onChooseAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const onAvatarSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setError('');

            if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
                throw new Error('Only JPG, PNG, and WebP images are allowed');
            }

            if (file.size > MAX_AVATAR_SIZE) {
                throw new Error('Avatar must be 2 MB or smaller');
            }

            const objectUrl = URL.createObjectURL(file);
            setCropImageSrc(objectUrl);
            setCropperOpen(true);
        } catch (e2) {
            const msg = e2.message || 'Failed to prepare avatar';
            setError(msg);
            showToast(msg, { type: 'error' });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const onAvatarCropDone = async (croppedBlob) => {
        const croppedFile = new File(
            [croppedBlob],
            'avatar.webp',
            { type: croppedBlob.type || 'image/webp' }
        );

        closeCropper();

        try {
            await uploadAvatarFile(croppedFile);
        } catch (e) {
            const msg = e.message || 'Failed to upload avatar';
            setError(msg);
            showToast(msg, { type: 'error' });
            setUploadingAvatar(false);
        }
    };

    const removeAvatar = async () => {
        try {
            setError('');
            setRemovingAvatar(true);

            const { data } = await api.delete('/users/me/avatar', {
                withCredentials: true,
            });

            applyUserData(data.user);
            showToast('Avatar removed', { type: 'success' });
        } catch (e2) {
            const msg = e2.response?.data?.error || e2.message || 'Failed to remove avatar';
            setError(msg);
            showToast(msg, { type: 'error' });
        } finally {
            setRemovingAvatar(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();

        setSaving(true);
        setError('');

        try {
            const payload = {
                username: form.username.trim(),
                displayName: form.displayName.trim() || null,
            };

            const { data } = await api.patch('/users/me', payload, {
                withCredentials: true,
            });

            applyUserData(data);
            showToast('Account updated', { type: 'success' });
        } catch (e2) {
            const msg = e2.response?.data?.error || e2.message || 'Failed to save account settings';
            setError(msg);
            showToast(msg, { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Loader />;
    }

    if (error && !initialData) {
        return (
            <div className="accountsettings">
                <div className="accountsettings-state is-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="accountsettings">
            <form className="accountsettings-form" onSubmit={onSubmit}>
                <div className="accountsettings-form-rim" />
                <div className="accountsettings-form-glow" />

                <div className="accountsettings-form-inner">
                    <header className="accountsettings-header">
                        <div className="accountsettings-header-copy">
                            <p className="accountsettings-header-eyebrow">Account</p>
                            <h1 className="accountsettings-header-title">Edit your profile</h1>
                            <p className="accountsettings-header-subtitle">
                                Update your username, display name, and profile picture.
                            </p>
                        </div>
                    </header>

                    <section className="accountsettings-section">
                        <div className="accountsettings-section-head">
                            <div>
                                <h3>Profile picture</h3>
                                <p>Upload a JPG, PNG, or WebP image up to 2 MB.</p>
                            </div>
                        </div>

                        <div className="accountsettings-avatar">
                            <div className="accountsettings-avatar-preview">
                                <Avatar
                                    user={form}
                                    n={3.25}
                                    version={form.avatarStorageKey || form.avatarUpdatedAt || undefined}
                                    alt="Profile"
                                />
                            </div>

                            <div className="accountsettings-avatar-copy">
                                <strong>Current avatar</strong>
                                <p>
                                    {form.avatarUrl
                                        ? 'You already have a profile picture.'
                                        : 'No profile picture yet.'}
                                </p>

                                <div className="accountsettings-avatar-actions">
                                    <Button
                                        variant="white"
                                        text={uploadingAvatar ? 'Uploading…' : (form.avatarUrl ? 'Change avatar' : 'Upload avatar')}
                                        type="button"
                                        onClick={onChooseAvatarClick}
                                        disabled={uploadingAvatar || removingAvatar}
                                    />

                                    {form.avatarUrl && (
                                        <Button
                                            variant="white"
                                            text={removingAvatar ? 'Removing…' : 'Remove avatar'}
                                            type="button"
                                            onClick={removeAvatar}
                                            disabled={uploadingAvatar || removingAvatar}
                                        />
                                    )}
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={onAvatarSelected}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="accountsettings-section">
                        <div className="accountsettings-section-head">
                            <div>
                                <h3>Account details</h3>
                                <p>These are the details shown around your account.</p>
                            </div>
                        </div>

                        <div className="accountsettings-grid">
                            <label className="accountsettings-field">
                                <span className="accountsettings-field-label">Username</span>
                                <input
                                    className="accountsettings-input"
                                    type="text"
                                    name="username"
                                    value={form.username}
                                    onChange={onChange}
                                    placeholder="Username"
                                    autoComplete="username"
                                    required
                                />
                            </label>

                            <label className="accountsettings-field">
                                <span className="accountsettings-field-label">Display name</span>
                                <input
                                    className="accountsettings-input"
                                    type="text"
                                    name="displayName"
                                    value={form.displayName}
                                    onChange={onChange}
                                    placeholder="Display name"
                                />
                            </label>

                            <label className="accountsettings-field accountsettings-field-full">
                                <span className="accountsettings-field-label">Email</span>
                                <input
                                    className="accountsettings-input is-readonly"
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    readOnly
                                    disabled
                                />
                            </label>
                        </div>
                    </section>

                    {error && (
                        <div className="accountsettings-error">
                            {error}
                        </div>
                    )}

                    <div className="accountsettings-footer">
                        <Button
                            variant="primary"
                            text={saving ? 'Saving…' : 'Save changes'}
                            type="submit"
                            disabled={saving || uploadingAvatar || removingAvatar || !isDirty}
                        />
                    </div>
                </div>
            </form>
            {cropperOpen && cropImageSrc && (
                <div className="cropper-modal" role="dialog" aria-modal="true">
                    <div className="cropper-modal-inner">
                        <ImageCropper
                            imageSrc={cropImageSrc}
                            aspect={1}
                            outputWidth={256}
                            outputHeight={256}
                            outputMimeType="image/webp"
                            outputQuality={0.82}
                            onCropDone={onAvatarCropDone}
                            onCancel={closeCropper}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}