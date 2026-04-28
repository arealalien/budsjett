import React, { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useOutletContext, useParams } from 'react-router-dom';
import { upload } from '@vercel/blob/client';
import Button from '../components/Button';
import ImageCropper from '../components/utils/ImageCropper';
import { useToast } from '../components/utils/ToastContext';
import { extractPaletteFromBlob, pickBannerColor } from '../lib/palette';

const MAX_BANNER_SIZE = 6 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function BudgetSettings() {
    const { slug } = useParams();
    const { budget, reloadBudget } = useOutletContext();
    const { showToast } = useToast();

    const fileInputRef = useRef(null);

    const [error, setError] = useState('');
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [removingBanner, setRemovingBanner] = useState(false);

    const [cropImageSrc, setCropImageSrc] = useState('');
    const [cropperOpen, setCropperOpen] = useState(false);

    const closeCropper = () => {
        if (cropImageSrc?.startsWith('blob:')) {
            URL.revokeObjectURL(cropImageSrc);
        }
        setCropImageSrc('');
        setCropperOpen(false);
    };

    const onChooseBannerClick = () => {
        fileInputRef.current?.click();
    };

    const onBannerSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setError('');

            if (!ALLOWED_BANNER_TYPES.has(file.type)) {
                throw new Error('Only JPG, PNG, and WebP images are allowed');
            }

            if (file.size > MAX_BANNER_SIZE) {
                throw new Error('Banner must be 6 MB or smaller');
            }

            const objectUrl = URL.createObjectURL(file);
            setCropImageSrc(objectUrl);
            setCropperOpen(true);
        } catch (err) {
            const msg = err.message || 'Failed to prepare banner';
            setError(msg);
            showToast(msg, { type: 'error' });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const uploadBannerFile = async (file, bannerPalette, bannerColor) => {
        setUploadingBanner(true);
        setError('');

        try {
            const blob = await upload(`budget-banners/${slug}/banner.webp`, file, {
                access: 'public',
                handleUploadUrl: `/api/budget/${encodeURIComponent(slug)}/banner`,
            });

            await api.patch(
                `/budget/${encodeURIComponent(slug)}/banner`,
                {
                    bannerUrl: blob.url,
                    bannerStorageKey: blob.pathname,
                    bannerColor,
                    bannerPalette,
                },
                { withCredentials: true }
            );

            await reloadBudget?.();
            showToast('Banner updated', { type: 'success' });
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to upload banner';
            setError(msg);
            showToast(msg, { type: 'error' });
            throw err;
        } finally {
            setUploadingBanner(false);
        }
    };

    const onBannerCropDone = async (croppedBlob) => {
        closeCropper();

        try {
            const bannerPalette = await extractPaletteFromBlob(croppedBlob);
            const bannerColor = pickBannerColor(bannerPalette);

            const croppedFile = new File(
                [croppedBlob],
                'banner.webp',
                { type: croppedBlob.type || 'image/webp' }
            );

            await uploadBannerFile(croppedFile, bannerPalette, bannerColor);
        } catch (err) {
            const msg = err.message || 'Failed to process banner';
            setError(msg);
            showToast(msg, { type: 'error' });
        }
    };

    const removeBanner = async () => {
        try {
            setError('');
            setRemovingBanner(true);

            await api.delete(`/budget/${encodeURIComponent(slug)}/banner`, {
                withCredentials: true,
            });

            await reloadBudget?.();
            showToast('Banner removed', { type: 'success' });
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to remove banner';
            setError(msg);
            showToast(msg, { type: 'error' });
        } finally {
            setRemovingBanner(false);
        }
    };

    return (
        <div className="budget-settings">
            <div className="budget-settings-section">
                <div className="budget-settings-section-head">
                    <div>
                        <h3>Budget banner</h3>
                        <p>Upload a wide banner image for this budget.</p>
                    </div>
                </div>

                <div className="budget-settings-banner">
                    <div
                        className="budget-settings-banner-preview"
                        style={
                            budget?.bannerUrl
                                ? { backgroundImage: `url(${budget.bannerUrl})` }
                                : undefined
                        }
                    >
                        {!budget?.bannerUrl && (
                            <div className="budget-settings-banner-placeholder">
                                No banner uploaded
                            </div>
                        )}
                    </div>

                    <div className="budget-settings-banner-actions">
                        <Button
                            variant="white"
                            text={uploadingBanner ? 'Uploading…' : (budget?.bannerUrl ? 'Change banner' : 'Upload banner')}
                            type="button"
                            onClick={onChooseBannerClick}
                            disabled={uploadingBanner || removingBanner}
                        />

                        {budget?.bannerUrl && (
                            <Button
                                variant="white"
                                text={removingBanner ? 'Removing…' : 'Remove banner'}
                                type="button"
                                onClick={removeBanner}
                                disabled={uploadingBanner || removingBanner}
                            />
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={onBannerSelected}
                    />
                </div>

                {error && (
                    <div className="budget-settings-error">
                        {error}
                    </div>
                )}
            </div>

            {cropperOpen && cropImageSrc && (
                <div className="cropper-modal" role="dialog" aria-modal="true">
                    <div className="cropper-modal-inner">
                        <ImageCropper
                            imageSrc={cropImageSrc}
                            aspect={3}
                            outputWidth={1800}
                            outputHeight={600}
                            outputMimeType="image/webp"
                            outputQuality={0.86}
                            onCropDone={onBannerCropDone}
                            onCancel={closeCropper}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}