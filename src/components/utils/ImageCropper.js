import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Cropper, RectangleStencil } from 'react-mobile-cropper';
import 'react-mobile-cropper/dist/style.css';
import Button from '../Button';

export default function ImageCropper({
                                         imageSrc,
                                         aspect,
                                         onCropDone,
                                         onCancel,
                                         outputWidth: outputWidthProp,
                                         outputHeight: outputHeightProp,
                                         outputMimeType = 'image/webp',
                                         outputQuality = 0.82,
                                     }) {
    const cropperRef = useRef(null);

    const [baseRotation, setBaseRotation] = useState(0);
    const [tilt, setTilt] = useState(0);
    const appliedRotationRef = useRef(0);

    const { outputWidth, outputHeight } = useMemo(() => {
        if (typeof outputWidthProp === 'number' && typeof outputHeightProp === 'number') {
            return { outputWidth: outputWidthProp, outputHeight: outputHeightProp };
        }
        if (aspect === 1) return { outputWidth: 256, outputHeight: 256 };
        return { outputWidth: 2560, outputHeight: 500 };
    }, [aspect, outputWidthProp, outputHeightProp]);

    const setCropperInstance = (cropper) => {
        cropperRef.current = cropper;
    };

    useEffect(() => {
        const cropper = cropperRef.current;
        if (!cropper) return;

        const target = baseRotation + tilt;
        let delta = target - appliedRotationRef.current;

        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        if (Math.abs(delta) > 0.0001) {
            cropper.rotateImage(delta);
            appliedRotationRef.current = target;
        }
    }, [baseRotation, tilt]);

    const rotateLeft90 = () => {
        setBaseRotation((r) => (r - 90 + 360) % 360);
    };

    const flipH = () => cropperRef.current?.flipImage(true, false);
    const flipV = () => cropperRef.current?.flipImage(false, true);

    const handleDone = () => {
        const cropper = cropperRef.current;
        if (!cropper) return;

        const canvas = cropper.getCanvas({
            width: outputWidth,
            height: outputHeight,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (blob) onCropDone(blob);
        }, outputMimeType, outputQuality);
    };

    useEffect(() => {
        appliedRotationRef.current = 0;
        setBaseRotation(0);
        setTilt(0);
    }, [imageSrc]);

    return (
        <>
            <Cropper
                src={imageSrc}
                stencilComponent={RectangleStencil}
                stencilProps={{ aspectRatio: aspect }}
                imageRestriction="stencil"
                moveImage={true}
                resizeImage={true}
                onChange={setCropperInstance}
                className="advanced-cropper"
            />

            <div className="cropper-modal-inner-toptools">
                <Button variant="gray" text="Cancel" type="button" onClick={onCancel} />

                <div className="cropper-modal-inner-toptools-center">
                    <button
                        type="button"
                        className="cropper-modal-inner-toptools-center-button"
                        onClick={rotateLeft90}
                    >
                        <span className="material-symbols-rounded">rotate_left</span>
                        <span>Rotate 90°</span>
                    </button>

                    <button
                        type="button"
                        className="cropper-modal-inner-toptools-center-button"
                        onClick={flipH}
                    >
                        <span className="material-symbols-rounded">flip</span>
                        <span>Flip H</span>
                    </button>

                    <button
                        type="button"
                        className="cropper-modal-inner-toptools-center-button"
                        onClick={flipV}
                    >
                        <span className="material-symbols-rounded">flip</span>
                        <span>Flip V</span>
                    </button>
                </div>

                <Button variant="primary" text="Crop & Save" type="button" onClick={handleDone} />
            </div>
        </>
    );
}