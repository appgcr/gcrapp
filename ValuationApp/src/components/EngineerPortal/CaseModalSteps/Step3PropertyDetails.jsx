import React from 'react';
import { Plus, X, ChevronRight } from 'lucide-react';
import { FLOOR_LABELS, formatCurrency, toFieldValue } from './caseModalHelpers';

export default function Step3PropertyDetails({
  propertyDetails = {},
  setPropertyDetails,
  propertyTypes = [],
  plotTypes = [],
  roadTypes = [],
  structureTypes = [],
  flooringTypes = [],
  renderFieldBadge,
  renderConflictOptions,
  setManuallyModifiedFields,
  handleNextToSiteImages
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '16px', paddingBottom: '16px' }}>
      
      {/* Property Category */}
      <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0369a1', marginBottom: '12px' }}>
          Report Category <span style={{ color: '#ef4444' }}>*</span>
          {renderFieldBadge && renderFieldBadge('propertyType')}
        </label>
        <select
          value={toFieldValue(propertyDetails.propertyType)}
          onChange={e => {
            setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('propertyType'));
            setPropertyDetails({...propertyDetails, propertyType: e.target.value});
          }}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #bae6fd', fontSize: '14px', outline: 'none', backgroundColor: 'white', fontWeight: '600' }}
        >
          <option value="">Select Category...</option>
          {propertyTypes.map(pt => (
            <option key={pt} value={pt}>{pt}</option>
          ))}
        </select>
        {renderConflictOptions && renderConflictOptions('propertyType')}
      </div>

      {/* Legal & Registration Details */}
      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
          Legal & Registration
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Deed Number <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('deedNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.deedNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('deedNo'));
                setPropertyDetails({...propertyDetails, deedNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 4004/2016"
            />
            {renderConflictOptions && renderConflictOptions('deedNo')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Deed Date/Year
              {renderFieldBadge && renderFieldBadge('deedYear')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.deedYear)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('deedYear'));
                setPropertyDetails({...propertyDetails, deedYear: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 12-02-2016"
            />
            {renderConflictOptions && renderConflictOptions('deedYear')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Net Extent / Area <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('netExtent')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.netExtent)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('netExtent'));
                setPropertyDetails({...propertyDetails, netExtent: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 2.83 Cents"
            />
            {renderConflictOptions && renderConflictOptions('netExtent')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Khatha Number
              {renderFieldBadge && renderFieldBadge('khathaNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.khathaNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('khathaNo'));
                setPropertyDetails({...propertyDetails, khathaNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="Optional"
            />
            {renderConflictOptions && renderConflictOptions('khathaNo')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Survey Number <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('surveyNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.surveyNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('surveyNo'));
                setPropertyDetails({...propertyDetails, surveyNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 343 or 347/2"
            />
            {renderConflictOptions && renderConflictOptions('surveyNo')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Plot Number
              {renderFieldBadge && renderFieldBadge('plotNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.plotNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('plotNo'));
                setPropertyDetails({...propertyDetails, plotNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="Optional"
            />
            {renderConflictOptions && renderConflictOptions('plotNo')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Property Tax / Assessment No
              {renderFieldBadge && renderFieldBadge('assessmentNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.assessmentNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('assessmentNo'));
                setPropertyDetails({...propertyDetails, assessmentNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 1013104872"
            />
            {renderConflictOptions && renderConflictOptions('assessmentNo')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Door / House Number
              {renderFieldBadge && renderFieldBadge('doorNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.doorNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('doorNo'));
                setPropertyDetails({...propertyDetails, doorNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 58/384-2-1-2"
            />
            {renderConflictOptions && renderConflictOptions('doorNo')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Building Appr. No
              {renderFieldBadge && renderFieldBadge('approvalPlanNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.approvalPlanNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('approvalPlanNo'));
                setPropertyDetails({...propertyDetails, approvalPlanNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="e.g. 1013/0114/B/KAD"
            />
            {renderConflictOptions && renderConflictOptions('approvalPlanNo')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Appr. Date
              {renderFieldBadge && renderFieldBadge('approvalPlanDate')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.approvalPlanDate)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('approvalPlanDate'));
                setPropertyDetails({...propertyDetails, approvalPlanDate: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="Optional"
            />
            {renderConflictOptions && renderConflictOptions('approvalPlanDate')}
          </div>
        </div>
      </div>

      {/* Builder & Apartment Details */}
      {(propertyDetails.propertyType === 'Apartment') && (
        <div style={{ backgroundColor: '#fdf4ff', padding: '12px', borderRadius: '12px', border: '1px solid #f5d0fe' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#86198f', marginBottom: '12px' }}>
            Builder & Flat Details
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>
                Builder Name <span style={{ color: '#ef4444' }}>*</span>
                {renderFieldBadge && renderFieldBadge('builderName')}
              </label>
              <input
                type="text"
                value={toFieldValue(propertyDetails.builderName)}
                onChange={e => {
                  setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('builderName'));
                  setPropertyDetails({...propertyDetails, builderName: e.target.value});
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }}
                placeholder="e.g. M/S KHAN INFRA TECH"
              />
              {renderConflictOptions && renderConflictOptions('builderName')}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>
                Managing Partner
                {renderFieldBadge && renderFieldBadge('managingPartner')}
              </label>
              <input
                type="text"
                value={toFieldValue(propertyDetails.managingPartner)}
                onChange={e => {
                  setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('managingPartner'));
                  setPropertyDetails({...propertyDetails, managingPartner: e.target.value});
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }}
                placeholder="Name"
              />
              {renderConflictOptions && renderConflictOptions('managingPartner')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>
                Flat No <span style={{ color: '#ef4444' }}>*</span>
                {renderFieldBadge && renderFieldBadge('flatNo')}
              </label>
              <input
                type="text"
                value={toFieldValue(propertyDetails.flatNo)}
                onChange={e => {
                  setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('flatNo'));
                  setPropertyDetails({...propertyDetails, flatNo: e.target.value});
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }}
                placeholder="e.g. 402"
              />
              {renderConflictOptions && renderConflictOptions('flatNo')}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>
                Floor Level
                {renderFieldBadge && renderFieldBadge('floorNo')}
              </label>
              <input
                type="text"
                value={toFieldValue(propertyDetails.floorNo)}
                onChange={e => {
                  setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('floorNo'));
                  setPropertyDetails({...propertyDetails, floorNo: e.target.value});
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }}
                placeholder="e.g. Fourth Floor"
              />
              {renderConflictOptions && renderConflictOptions('floorNo')}
            </div>
          </div>
        </div>
      )}

      {/* APGB Format Details */}
      <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '12px', border: '1px solid #fde047' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#b45309', marginBottom: '12px' }}>
          APGB Valuation Details
        </label>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Father's/Spouse Name
              {renderFieldBadge && renderFieldBadge('fathersName')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.fathersName)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('fathersName'));
                setPropertyDetails({...propertyDetails, fathersName: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none' }}
              placeholder="Name"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Branch Name
              {renderFieldBadge && renderFieldBadge('branchName')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.branchName)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('branchName'));
                setPropertyDetails({...propertyDetails, branchName: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none' }}
              placeholder="Branch"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Ward No
              {renderFieldBadge && renderFieldBadge('wardNo')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.wardNo)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('wardNo'));
                setPropertyDetails({...propertyDetails, wardNo: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Total Valuation
              {renderFieldBadge && renderFieldBadge('valuationTotal')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.valuationTotal)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('valuationTotal'));
                setPropertyDetails({...propertyDetails, valuationTotal: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none', fontWeight: 'bold' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Land Value
              {renderFieldBadge && renderFieldBadge('valuationLand')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.valuationLand)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('valuationLand'));
                setPropertyDetails({...propertyDetails, valuationLand: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
              Building Value
              {renderFieldBadge && renderFieldBadge('valuationBuilding')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.valuationBuilding)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('valuationBuilding'));
                setPropertyDetails({...propertyDetails, valuationBuilding: e.target.value});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Boundaries (As per documents) */}
      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
          Boundaries (As per documents) <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              North <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesDoc.north')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesDoc?.north)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesDoc.north'));
                setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, north: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            {renderConflictOptions && renderConflictOptions('boundariesDoc.north')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              South <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesDoc.south')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesDoc?.south)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesDoc.south'));
                setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, south: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            {renderConflictOptions && renderConflictOptions('boundariesDoc.south')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              East <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesDoc.east')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesDoc?.east)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesDoc.east'));
                setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, east: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            {renderConflictOptions && renderConflictOptions('boundariesDoc.east')}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              West <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesDoc.west')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesDoc?.west)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesDoc.west'));
                setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, west: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            {renderConflictOptions && renderConflictOptions('boundariesDoc.west')}
          </div>
        </div>
      </div>
      
      {/* Boundaries (As per actual / visit) */}
      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
          Boundaries (As per actual / visit) <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              North <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesActual.north')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesActual?.north)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesActual.north'));
                setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, north: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              South <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesActual.south')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesActual?.south)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesActual.south'));
                setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, south: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              East <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesActual.east')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesActual?.east)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesActual.east'));
                setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, east: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              West <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('boundariesActual.west')}
            </label>
            <input
              type="text"
              value={toFieldValue(propertyDetails.boundariesActual?.west)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('boundariesActual.west'));
                setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, west: e.target.value}});
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>
      </div>
      
      {/* Structural & Site Visit Details */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Age of Building <span style={{ color: '#ef4444' }}>*</span>
            {renderFieldBadge && renderFieldBadge('buildingAge')}
          </label>
          <input
            type="number"
            value={toFieldValue(propertyDetails.buildingAge)}
            onChange={e => {
              setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('buildingAge'));
              setPropertyDetails({...propertyDetails, buildingAge: e.target.value});
            }}
            placeholder="Years"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          />
          {renderConflictOptions && renderConflictOptions('buildingAge')}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Road Width <span style={{ color: '#ef4444' }}>*</span>
            {renderFieldBadge && renderFieldBadge('roadWidth')}
          </label>
          <input
            type="text"
            value={toFieldValue(propertyDetails.roadWidth)}
            onChange={e => {
              setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('roadWidth'));
              setPropertyDetails({...propertyDetails, roadWidth: e.target.value});
            }}
            placeholder="e.g. 30 ft"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
          />
          {renderConflictOptions && renderConflictOptions('roadWidth')}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Plot Type <span style={{ color: '#ef4444' }}>*</span>
            {renderFieldBadge && renderFieldBadge('plotType')}
          </label>
          <select
            value={toFieldValue(propertyDetails.plotType)}
            onChange={e => {
              setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('plotType'));
              setPropertyDetails({...propertyDetails, plotType: e.target.value});
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="">Select...</option>
            {plotTypes.map(pt => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
          {renderConflictOptions && renderConflictOptions('plotType')}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Type of Road <span style={{ color: '#ef4444' }}>*</span>
            {renderFieldBadge && renderFieldBadge('roadType')}
          </label>
          <select
            value={toFieldValue(propertyDetails.roadType)}
            onChange={e => {
              setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('roadType'));
              setPropertyDetails({...propertyDetails, roadType: e.target.value});
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="">Select...</option>
            {roadTypes.map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
          {renderConflictOptions && renderConflictOptions('roadType')}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Type of Structure <span style={{ color: '#ef4444' }}>*</span>
            {renderFieldBadge && renderFieldBadge('structureType')}
          </label>
          <select
            value={toFieldValue(propertyDetails.structureType)}
            onChange={e => {
              setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('structureType'));
              setPropertyDetails({...propertyDetails, structureType: e.target.value});
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}
          >
            <option value="">Select...</option>
            {structureTypes.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          {renderConflictOptions && renderConflictOptions('structureType')}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Type of Flooring <span style={{ color: '#ef4444' }}>*</span>
          {renderFieldBadge && renderFieldBadge('flooringType')}
        </label>
        <select
          value={toFieldValue(propertyDetails.flooringType)}
          onChange={e => {
            setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('flooringType'));
            setPropertyDetails({...propertyDetails, flooringType: e.target.value});
          }}
          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}
        >
          <option value="">Select...</option>
          {flooringTypes.map(ft => (
            <option key={ft} value={ft}>{ft}</option>
          ))}
        </select>
        {renderConflictOptions && renderConflictOptions('flooringType')}
      </div>

      {/* Additions Work / Cost Estimates */}
      {['Apartment', 'Independent House'].includes(propertyDetails.propertyType) && (
        <div style={{ padding: '16px', backgroundColor: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#c2410c', margin: 0 }}>Additions Work Estimation</label>
            <button 
              type="button"
              onClick={() => {
                const newAdditions = [...(propertyDetails.additionsWork || []), { id: Date.now(), description: '', quantity: '1', rate: '', amount: '' }];
                setPropertyDetails({...propertyDetails, additionsWork: newAdditions});
              }}
              style={{ backgroundColor: 'transparent', border: 'none', color: '#c2410c', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
          
          {(!propertyDetails.additionsWork || propertyDetails.additionsWork.length === 0) && (
            <div style={{ fontSize: '12px', color: '#fdba74', textAlign: 'center', padding: '12px 0' }}>
              No items added yet. Click 'Add Item' to estimate costs for wardrobes, painting, etc.
            </div>
          )}

          {(propertyDetails.additionsWork || []).map((item, index) => (
            <div key={item.id} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              padding: '10px 12px', 
              backgroundColor: '#ffffff', 
              borderRadius: '8px', 
              border: '1px solid #fed7aa', 
              marginBottom: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#c2410c', marginBottom: '3px' }}>Description</label>
                  <input 
                    type="text" 
                    value={item.description} 
                    onChange={e => {
                      const newWork = [...propertyDetails.additionsWork];
                      newWork[index].description = e.target.value;
                      setPropertyDetails({...propertyDetails, additionsWork: newWork});
                    }} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '13px', outline: 'none' }} 
                    placeholder="e.g. Wardrobes, Painting" 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    const newWork = propertyDetails.additionsWork.filter((_, i) => i !== index);
                    setPropertyDetails({...propertyDetails, additionsWork: newWork});
                  }} 
                  style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '16px' }}
                  title="Remove Item"
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#c2410c', marginBottom: '3px' }}>Qty</label>
                  <input 
                    type="text" 
                    value={item.quantity} 
                    onChange={e => {
                      const newWork = [...propertyDetails.additionsWork];
                      newWork[index].quantity = e.target.value;
                      setPropertyDetails({...propertyDetails, additionsWork: newWork});
                    }} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '13px', outline: 'none' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#c2410c', marginBottom: '3px' }}>Amount (₹)</label>
                  <input 
                    type="number" 
                    value={item.amount} 
                    onChange={e => {
                      const newWork = [...propertyDetails.additionsWork];
                      newWork[index].amount = e.target.value;
                      setPropertyDetails({...propertyDetails, additionsWork: newWork});
                    }} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '13px', outline: 'none' }} 
                    placeholder="Amount in ₹" 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Site Value & Floors */}
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>Site Value / Area Value</label>
          <button 
            type="button"
            onClick={() => {
              const currentFloors = propertyDetails.siteValue?.floors || [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }];
              if (currentFloors.length < FLOOR_LABELS.length) {
                const newFloors = [...currentFloors, { id: `f${currentFloors.length}`, label: FLOOR_LABELS[currentFloors.length], value: '' }];
                setPropertyDetails({...propertyDetails, siteValue: {...(propertyDetails.siteValue || {}), floors: newFloors}});
              }
            }}
            style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
          >
            <Plus size={14} /> Add Floor
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Plinth Area Value <span style={{ color: '#ef4444' }}>*</span>
              {renderFieldBadge && renderFieldBadge('plinthArea')}
            </label>
            <input
              type="text"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              placeholder="Value"
              value={toFieldValue(propertyDetails.siteValue?.plinthArea)}
              onChange={e => {
                setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('siteValue'));
                setPropertyDetails({...propertyDetails, siteValue: {...(propertyDetails.siteValue || {}), plinthArea: formatCurrency(e.target.value)}});
              }}
            />
          </div>
          {(propertyDetails.siteValue?.floors || [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }]).map((floor, index) => (
            <div key={floor.id} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {floor.label} <span style={{ color: '#ef4444' }}>*</span>
                {index === (propertyDetails.siteValue?.floors?.length || 1) - 1 && index > 0 && (
                  <span 
                    onClick={() => {
                      const newFloors = (propertyDetails.siteValue?.floors || []).slice(0, -1);
                      setPropertyDetails({...propertyDetails, siteValue: {...(propertyDetails.siteValue || {}), floors: newFloors}});
                    }}
                    style={{ color: '#ef4444', marginLeft: '6px', cursor: 'pointer', fontSize: '10px' }}
                  >
                    (Remove)
                  </span>
                )}
              </label>
              <input
                type="text"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                placeholder="Value"
                value={toFieldValue(floor.value)}
                onChange={e => {
                  setManuallyModifiedFields && setManuallyModifiedFields(prev => new Set(prev).add('siteValue'));
                  const newFloors = [...(propertyDetails.siteValue?.floors || [])];
                  newFloors[index].value = formatCurrency(e.target.value);
                  setPropertyDetails({...propertyDetails, siteValue: {...(propertyDetails.siteValue || {}), floors: newFloors}});
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={handleNextToSiteImages} style={{ marginTop: '16px' }}>
        Next: Site Images <ChevronRight size={18} />
      </button>
    </div>
  );
}
