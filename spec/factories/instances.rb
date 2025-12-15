# frozen_string_literal: true
FactoryGirl.define do
  factory :instance do
    association :owner, factory: :user
    title 'Test Instance'
  end
end
